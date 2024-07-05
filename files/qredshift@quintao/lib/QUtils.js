const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
// const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;

const St = imports.gi.St;
const Gio = imports.gi.Gio;

// const BoxPointer = imports.ui.boxpointer;
// const DND = imports.ui.dnd;
// const Main = imports.ui.main;
// const SignalManager = imports.misc.signalManager;
// const Tweener = imports.ui.tweener;
// const CheckBox = imports.ui.checkBox;
// const RadioButton = imports.ui.radioButton;

const ByteArray = imports.byteArray;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;

const MessageTray = imports.ui.main.messageTray;
const Tray = imports.ui.messageTray;

// /** @type QGui */
// const QGui = require('./lib/QGui.js');

/**
 * @typedef QUtils
 * @exports QUtils
 */

/** @exports QUtils.delay */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** @exports QUtils.get_envs */
function get_envs() {
  let tmp = spawn_command_line_sync_string_response('env');
  if(tmp.success) {
    return  tmp.stdout.trim().split('\n').reduce((p, c) => {
      let [k, v] = c.split("=");
      p[k] = v;
      return p;
    }, {});
  }

  return {};
}

/** @exports QUtils.is_wayland */
function is_wayland() {
  // let envs = get_envs();
  return get_envs()['XDG_SESSION_TYPE'] == 'wayland';
}

/** @exports QUtils.architeture */
function architeture() {
  return spawn_command_line_sync_string_response('uname -m').stdout.trim();
}

/** @exports QUtils.is_arch_linux */
function is_arch_linux() {
  // All Arch-based distributions have the /etc/arch-release file,
  // even if it's empty.
  return Gio.file_new_for_path("/etc/arch-release").query_exists(null);
}

/** @exports QUtils.lerp */
function lerp(if_t_zero, if_t_one, t) {
  return (if_t_zero + (if_t_one - if_t_zero) * t);
}

/**
 * @exports QUtils.byte_array_to_string
 * @param {Number[]} data
 * @return {string}
 */
function byte_array_to_string(data) {
  if (ByteArray.hasOwnProperty("toString")) {
    return "" + ByteArray.toString(data);
  }
  return "" + data;
}

/**
 * @param {string|array} command
 * @return {{success: boolean, stdout: string, stderr: string, wait_status: number}}
 * @exports QUtils.spawn_command_line_sync_string_response
 */
function spawn_command_line_sync_string_response(command) {
  try {
    qLOG('SYNC', command, typeof command);

    let params = null;

    if (typeof command == "string") {
      let [success, argv] = GLib.shell_parse_argv(command);
      params = argv;
    }
    // var [result, standard_output, standard_error, exit_status, wait_status] = GLib.spawn_command_line_sync(command);


    let spawn_flags = GLib.SpawnFlags.SEARCH_PATH;
    let [result, stdout, stderr, wait_status] = GLib.spawn_sync(null, params, null, spawn_flags, null);


    return {
      success:     result,
      stdout:      byte_array_to_string(stdout),
      stderr:      byte_array_to_string(stderr),
      wait_status: wait_status
    };

  } catch (e) {
    return {
      success:     false,
      stdout:      '',
      stderr:      e,
      wait_status: 1
    };
  }
}

/**
 * @return {Promise<string>}
 * @exports QUtils.spawn_command_line_async_promise
 */
function spawn_command_line_async_promise(command, work_dir = null, watch = true) {
  function _parse(fd) {
    let output = '';
    let output_stream_out = new Gio.DataInputStream({base_stream: new Gio.UnixInputStream({fd: fd, close_fd: true})});

    let [line, size] = output_stream_out.read_line(null);
    while (line !== null) {
      output += line + '\n';
      [line, size] = output_stream_out.read_line(null);
    }

    return output;
  }

  return new Promise((resolve, reject) => {
    try {
      let [success, argv] = GLib.shell_parse_argv(command);
      if (!success) {
        reject("Failed to parse command");
      }

      let spawn_flags = GLib.SpawnFlags.SEARCH_PATH;
      if (watch) spawn_flags = spawn_flags | GLib.SpawnFlags.DO_NOT_REAP_CHILD;

      let [result, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(work_dir, argv, null, spawn_flags, null);

      if (watch) GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function (pid, status) {
        GLib.spawn_close_pid(pid);
      });

      let output = _parse(stdout);
      let output_err = _parse(stderr);

      // if (output_err) reject(output_err);
      // else resolve(output);
      if (result) {
        resolve(output);
      } else {
        reject({error: true, output, output_err});
      }

    } catch (e) {
      reject({error: true, message: 'command not found'});
    }

  });
}


/**
 * @exports QUtils.show_notification
 */
function show_notification(title, message, icon_name, icon_path = undefined) {
  let icon = new St.Icon({
    icon_type: St.IconType.SYMBOLIC,
    icon_size: 25
  });

  if (icon_path) {
    try {
      let file = Gio.file_new_for_path(icon_path);
      let ficon = new Gio.FileIcon({file: file});
      icon = new St.Icon({icon_size: 25});
      icon.set_gicon(ficon);
    } catch (e) {
      global.log(e);
    }
  } else {
    icon.set_icon_name(icon_name);
  }


  const source = new Tray.SystemNotificationSource('qredshift@quintao');
  MessageTray.add(source);

  const notification = new Tray.Notification(source, title, message, {icon: icon, silent: false});
  source.notify(notification);
}

/**
 * @exports QUtils.show_error_notification
 */
function show_error_notification(message) {
  this.show_notification('QRedshift', message, 'dialog-error');
}

/**
 * @exports QUtils.show_warning_notification
 */
function show_warning_notification(message) {
  this.show_notification('QRedshift', message, 'dialog-warning');
}

/**
 * @exports QUtils.show_info_notification
 */
function show_info_notification(message) {
  this.show_notification('QRedshift', message, 'dialog-information');
}


/** @exports QUtils.qLOG */
function qLOG(msg, ...data) {
  if (global.DEBUG == false) return;

  let str = `\n${msg}: `;

  if (data.length > 0) {
    let tmp = [];
    data.forEach(value => {
      tmp.push(formatLogArgument(value));
    });

    str += tmp.join(', ');
    // str += formatLogArgument(data);
  } else {
    // str = JSON.stringify(`${msg}`, null, 4);
    str = `\n${msg}`;
  }

  // global.log(str);
  global.logWarning(str);



  function formatLogArgument(arg = '', recursion = 0, depth = 4) {
    // global.logWarning(typeof arg);
    const GObject = imports.gi.GObject;
    // Make sure falsey values are clearly indicated.
    if (arg === null) {
      arg = 'null';
    } else if (arg === undefined) {
      arg = 'undefined';
      // Ensure strings are distinguishable.
    } else if (typeof arg === 'string' && recursion > 0) {
      arg = '\'' + arg + '\'';
    } else if (['boolean', 'number'].includes(typeof arg)) {
      arg = '' + arg;
    }
    // Check if we reached the depth threshold
    if (recursion + 1 > depth) {
      try {
        arg = JSON.stringify(arg);
      } catch (e) {
        arg = byte_array_to_string(arg);
      }
      return arg;
    }
    let isGObject = arg instanceof GObject.Object;

    let space = '';
    for (let i = 0; i < recursion + 1; i++) {
      space += '    ';
    }
    if (typeof arg === 'object') {
      let isArray = Array.isArray(arg);
      let brackets = isArray ? ['[', ']'] : ['{', '}'];
      if (isGObject) {
        arg = Util.getGObjectPropertyValues(arg);
        if (Object.keys(arg).length === 0) {
          return byte_array_to_string(arg);
        }
      }
      let array = isArray ? arg : Object.keys(arg);
      // Add beginning bracket with indentation
      let string = brackets[0] + (recursion + 1 > depth ? '' : '\n');
      for (let j = 0, len = array.length; j < len; j++) {
        if (isArray) {
          string += space + formatLogArgument(arg[j], recursion + 1, depth) + ',\n';
        } else {
          string += space + array[j] + ': ' + formatLogArgument(arg[array[j]], recursion + 1, depth) + ',\n';
        }
      }
      // Remove one level of indentation and add the closing bracket.
      space = space.substr(4, space.length);
      arg = string + space + brackets[1];
      // Functions, numbers, etc.
    } else if (typeof arg === 'function') {
      let array = arg.toString().split('\n');
      for (let i = 0; i < array.length; i++) {
        if (i === 0) continue;
        array[i] = space + array[i];
      }
      arg = array.join('\n');
    } else if (typeof arg !== 'string' || isGObject) {
      arg = byte_array_to_string(arg);
    }
    return arg;
  }


}


























