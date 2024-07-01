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

/**
 * @typedef QUtils
 * @exports QUtils
 */


/** @exports QUtils.is_wayland */
function is_wayland() {
    if (spawn_command_line_sync_string_response("echo $XDG_SESSION_TYPE")?.stdout.toLowerCase() == 'wayland') return true;
    return false;
}

/** @exports QUtils.architeture */
function architeture() {
    return spawn_command_line_sync_string_response('uname -m').stdout.trim()
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
 * @param {string} command
 * @return {{success: boolean, stdout: string, stderr: string, exit_status: number}}
 * @exports QUtils.spawn_command_line_sync_string_response
 */
function spawn_command_line_sync_string_response(command) {
    try {
        let [success, standard_output, standard_error, exit_status, wait_status] = GLib.spawn_command_line_sync(command);
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, wait_status, function (pid, status) {
            GLib.spawn_close_pid(pid);
        });
        
        return {
            success: success,
            stdout: byte_array_to_string(standard_output),
            stderr: byte_array_to_string(standard_error),
            exit_status: exit_status
        };
        
    } catch (e) {
        return {
            success: false,
            stdout: '',
            stderr: e,
            exit_status: 1
        };
    }
}

/**
 * @return {Promise<string>}
 * @exports QUtils.spawn_command_line_async_promise
 */
function spawn_command_line_async_promise(command, work_dir = null) {
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
            
            let spawn_flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD;
            
            let [result, pid, stdin, stdout, stderr] = GLib.spawn_async_with_pipes(work_dir, argv, null, spawn_flags, null);
            
            GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function (pid, status) {
                GLib.spawn_close_pid(pid);
            });
            
            let output = _parse(stdout);
            let output_err = _parse(stderr);
            
            // if (output_err) reject(output_err);
            // else resolve(output);
            if (output) resolve(output);
            else reject(output_err);
            
        } catch (e) {
            reject('command not found');
        }
        
    });
}


/**
 * @exports QUtils.show_notification
 */
function show_notification(title, message, icon_name) {
    const icon = new St.Icon({
        icon_type: St.IconType.SYMBOLIC,
        icon_name: icon_name,
        icon_size: 25
    });
    
    const source = new Tray.SystemNotificationSource('qredshift@quintao');
    MessageTray.add(source);
    const notification = new Tray.Notification(source, title, message, {icon: icon});
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


























