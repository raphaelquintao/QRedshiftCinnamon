// Process spawning helpers with no Cinnamon dependencies, so they can be
// unit tested with plain cjs (see tests/test_spawn.js).
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

/**
 * Run a command line and resolve with its standard output once it exits.
 *
 * The command runs in the background: the promise settles from the main
 * loop, so Cinnamon keeps painting and handling input while it runs. The
 * resolved value matches the previous helper: stdout with a trailing newline
 * added if missing, '' for no output, and the exit status is ignored. The
 * promise rejects with {error: true, message} only if the command could not
 * be started at all.
 *
 * @param {string} command
 * @param {string|null} work_dir
 * @param {boolean} watch  kept for signature compatibility; unused
 * @return {Promise<string>}
 * @exports QSpawn.spawn_command_line_async_promise
 */
function spawn_command_line_async_promise(command, work_dir = null, watch = true) {
  return new Promise((resolve, reject) => {
    let argv;
    try {
      let [success, parsed] = GLib.shell_parse_argv(command);
      if (!success) return reject({error: true, message: 'Failed to parse command'});
      argv = parsed;
    } catch (e) {
      return reject({error: true, message: 'Failed to parse command'});
    }

    let launcher = new Gio.SubprocessLauncher({
      flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    });
    if (work_dir) launcher.set_cwd(work_dir);

    let proc;
    try {
      proc = launcher.spawnv(argv);
    } catch (e) {
      return reject({error: true, message: 'command not found'});
    }

    proc.communicate_utf8_async(null, null, (p, res) => {
      let output = '';
      try {
        let [ok, stdout, stderr] = p.communicate_utf8_finish(res);
        output = stdout || '';
      } catch (e) {
        return reject({error: true, message: `${e}`});
      }
      if (output.length > 0 && !output.endsWith('\n')) output += '\n';
      resolve(output);
    });
  });
}

/**
 * Fetch JSON with curl from the first URL that answers with something
 * JSON.parse accepts. Used for the release check so that an unreachable
 * mirror falls back to the GitHub API instead of failing.
 *
 * @param {string[]} urls  tried in order
 * @param {string} curl_args  extra curl options, e.g. timeouts
 * @return {Promise<object>}  rejects with {error: true, message} if none work
 * @exports QSpawn.fetch_json_with_fallback
 */
function fetch_json_with_fallback(urls, curl_args = '--connect-timeout 15 --max-time 60') {
  // Declared as a plain function on purpose: Cinnamon's module loader only
  // exports top-level declarations that start with const/var/let/function/
  // class, so an `async function` here would be invisible to require().
  return (async () => {
    let last = 'no urls';
    for (const url of urls) {
      try {
        const body = await spawn_command_line_async_promise(`curl -s ${curl_args} ${url}`);
        if (body.trim().length === 0) throw new Error('empty response');
        return JSON.parse(body);
      } catch (e) {
        last = `${url}: ${e && e.message ? e.message : e}`;
      }
    }
    throw {error: true, message: 'All release URLs failed; last: ' + last};
  })();
}
