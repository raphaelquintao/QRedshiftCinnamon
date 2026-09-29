// Run with: cjs tests/test_spawn.js   (or tests/run.sh)
// Tests QSpawn.spawn_command_line_async_promise outside Cinnamon.
const GLib = imports.gi.GLib;

const here = GLib.path_get_dirname(imports.system.programPath || '.');
imports.searchPath.unshift(here + '/../files/qredshift@quintao/lib');
const QSpawn = imports.QSpawn;

let failures = 0;
function assert_eq(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) print('ok   ' + name);
  else { failures++; print('FAIL ' + name + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
}

const tests = [
  async function resolves_with_stdout() {
    assert_eq('resolves with stdout', await QSpawn.spawn_command_line_async_promise('echo hi'), 'hi\n');
  },
  async function adds_trailing_newline_like_old_helper() {
    assert_eq('adds trailing newline', await QSpawn.spawn_command_line_async_promise('printf abc'), 'abc\n');
  },
  async function empty_output_is_empty_string() {
    assert_eq('empty output', await QSpawn.spawn_command_line_async_promise('true'), '');
  },
  async function stderr_is_not_in_the_result() {
    assert_eq('stderr excluded', await QSpawn.spawn_command_line_async_promise("sh -c 'echo x >&2; echo y'"), 'y\n');
  },
  async function nonzero_exit_still_resolves() {
    assert_eq('nonzero exit resolves', await QSpawn.spawn_command_line_async_promise("sh -c 'echo out; exit 3'"), 'out\n');
  },
  async function work_dir_is_honoured() {
    assert_eq('work_dir', await QSpawn.spawn_command_line_async_promise('pwd', '/tmp'), '/tmp\n');
  },
  async function missing_command_rejects() {
    let rejected = false;
    try { await QSpawn.spawn_command_line_async_promise('definitely-not-a-command-xyz'); }
    catch (e) { rejected = !!(e && e.error); }
    assert_eq('missing command rejects', rejected, true);
  },
  async function does_not_block_the_main_loop() {
    // A 200 ms timer must fire while a 1 s command is still running. With
    // the old synchronous read the timer could only fire after the command
    // finished.
    let timer_fired_before_command_finished = false;
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => { timer_fired_before_command_finished = !done; return GLib.SOURCE_REMOVE; });
    let done = false;
    await QSpawn.spawn_command_line_async_promise('sleep 1');
    done = true;
    assert_eq('main loop not blocked', timer_fired_before_command_finished, true);
  },
];

const loop = GLib.MainLoop.new(null, false);
(async () => {
  for (const t of tests) {
    try { await t(); } catch (e) { failures++; print('FAIL ' + t.name + ': threw ' + e); }
  }
  loop.quit();
})();
loop.run();
print(failures ? failures + ' failure(s)' : 'all tests passed');
imports.system.exit(failures ? 1 : 0);
