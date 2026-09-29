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
