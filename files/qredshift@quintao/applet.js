const Applet = imports.ui.applet;

const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
// const Gtk = imports.gi.Gtk;
// const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Signals = imports.signals;
const Meta = imports.gi.Meta;

const Gettext = imports.gettext;
const UUID = "qredshift@quintao";

const HOME = GLib.get_home_dir();


Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
  return Gettext.dgettext(UUID, str);
}

global.DEBUG = false;


/** @type QUtils */
const QUtils = require('./lib/QUtils.js');

/** @type QGui */
const QGui = require('./lib/QGui.js');

/** @type QSunCalc */
const QSunCalc = require('./lib/QSunCalc.js');

const qLOG = QUtils.qLOG;
const lerp = QUtils.lerp;

// qLOG('=>>>>>>>>>>>>>>>>>>>>>', QSunCalc.SunCalc);

const QIcon = QGui.QIcon;
const QPopupHeader = QGui.QPopupHeader;
const QPopupIconBar = QGui.QPopupIconBar;
const QPopupSlider = QGui.QPopupSlider;
const QPopupSwitch = QGui.QPopupSwitch;
const QPopupLocation = QGui.QPopupLocation;

const UPDATE = {
  // I'm not using the public url, because of the 60 request per hour API limit.
  remote_releases_url:         "https://api.github.com/repos/raphaelquintao/QRedshiftCinnamon/releases/latest",
  remote_releases_url_quintao: "https://quintao.ninja/qghs/raphaelquintao/QRedshiftCinnamon/releases/latest",
};

class QRedshift extends Applet.TextIconApplet {

  /** @type imports.ui.popupMenu.PopupMenuSection | null */
  menu_info_section = null;

  /** @type QGui.QPopupHeader| null */
  redshift_info_menu_item = null;

  /** @type QGui.QPopupHeader | null */
  menu_arch_info = null;

  /** @type QGui.QPopupHeader | null */
  menu_wayland_info = null;

  /** @type QGui.QPopupLocation */
  menu_location = null;

  /** @type imports.ui.popupMenu.PopupMenuSection */
  menu_update = null;

  _current_temp = 0;
  _current_brightness = 0;
  current_gamma = 0;

  get current_temp() {
    return this._current_temp;
  }

  set current_temp(value) {
    this._current_temp = parseInt(value);
  }

  get current_brightness() {
    return this._current_brightness;
  }

  set current_brightness(value) {
    this._current_brightness = parseInt(value);
  }

  /** @type number */
  last_update = 0;

  archs = {
    supported: ["x86_64", "i686", "aarch64", "armv7l", "armv5tel", "mips64el", "mipsel", "powerpc64le", "s390x", "i386", "i486", "i586"],
    binaries: ["x86_64", "i686", "aarch64", "armv7l", "armv5tel", "mips64el", "mipsel", "powerpc64le", "s390x"],
    equivalent: {
      'i686': ["i386", "i486", "i586"]
    }
  }

  binary_suffix(arch) {
    if(this.archs.binaries.includes(arch)) return arch;
    for (let a in this.archs.equivalent) if(this.archs.equivalent[a].includes(a)) return a;
    return '';
  }


  // Options
  opt = {
    debug:               global.DEBUG,
    autoCheckUpdate:     true,
    checkUpdateInterval: 180,
    redshift_version:    0,
    enabled:             true,
    enableAtStartup:     false,
    autoUpdate:          false,
    autoUpdateInterval:  20,
    smoothTransition:    true,
    transitionDuration:  10, // In minutes
    labelScrollAction:   'disabled',
    iconLabel:           false,
    iconLabelAlways:     true,
    symbolicIcon:        false,

    keyToggle:         '',
    keyBrightnessUp:   '',
    keyBrightnessDown: '',
    keyTempUp:         '',
    keyTempDown:       '',
    keyGammaUp:        '',
    keyGammaDown:      '',

    stepTemp:   50,
    stepBright: 1,
    stepGamma:  0.01,

    dayTemp:       6500,
    dayBrightness: 1,
    gammaMix:      1,

    enabledNight:    false,
    manualNightTime: false,
    nightStart:      {
      h: 0,
      m: 0
    },
    nightEnd:        {
      h: 0,
      m: 0
    },
    nightTemp:       3500,
    nightBrightness: 1,

    locationRemote:    true,
    locationCity:      '',
    locationLatitude:  '0',
    locationLongitude: '0',
    period:            '-'
  };

  constructor(metadata, orientation, panel_height, instance_id) {
    super(orientation, panel_height, instance_id);
    this.metadata = metadata;



    this.time = {
      nightStart: {
        h: 0,
        m: 0
      },
      nightEnd:   {
        h: 0,
        m: 0
      },
    };

    this.wayland = QUtils.is_wayland();
    this.arch = QUtils.architeture();


    this.bin_path = `${this.metadata.path}/bin/qredshift_${this.binary_suffix(this.arch)}`;

    // Bind Settings
    this.settings = new Settings.AppletSettings(this.opt, metadata.uuid, instance_id);
    this.settings.getDesc = function (key) {
      if (this.settingsData[key] && this.settingsData[key].description)
        return this.settingsData[key].description;
      return '';
    };

    this.settings.bind('enabled', 'enabled', this.on_setting_change.bind(this), {key: 'enabled'});
    this.settings.bind("enableAtStartup", "enableAtStartup");
    this.settings.bind('autoUpdate', 'autoUpdate', this.on_setting_change.bind(this), {key: 'autoUpdate'});
    this.settings.bind('autoUpdateInterval', 'autoUpdateInterval', this.on_setting_change.bind(this), {key: 'autoUpdateInterval'});
    this.settings.bind('labelScrollAction', 'labelScrollAction');
    this.settings.bind('iconLabel', 'iconLabel', () => {
      this.hide_applet_label(!this.opt.iconLabel);
      this.enabledLabel.setToggleState(this.opt.iconLabel);
      if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
    });
    this.settings.bind('symbolicIcon', 'symbolicIcon', (value) => {
      // this.opt.symbolicIcon = value;
      this.set_icon();
    });
    this.settings.bind('smoothTransition', 'smoothTransition', this.on_setting_change.bind(this), {key: 'smoothTransition'});
    this.settings.bind('transitionDuration', 'transitionDuration', this.on_setting_change.bind(this), {key: 'transitionDuration'});


    this.settings.bind('dayTemp', 'dayTemp', this.on_setting_change.bind(this), {key: 'dayTemp'});
    this.settings.bind('dayBrightness', 'dayBrightness', this.on_setting_change.bind(this), {key: 'dayBrightness'});
    this.settings.bind('gammaMix', 'gammaMix', this.on_setting_change.bind(this), {key: 'gammaMix'});

    this.settings.bind('enabledNight', 'enabledNight', this.on_setting_change.bind(this), {key: 'enabledNight'});
    this.settings.bind('manualNightTime', 'manualNightTime', this.on_setting_change.bind(this), {key: 'manualNightTime'});
    this.settings.bind('nightTemp', 'nightTemp', this.on_setting_change.bind(this), {key: 'enabled'});
    this.settings.bind('nightBrightness', 'nightBrightness', this.on_setting_change.bind(this), {key: 'nightBrightness'});

    this.settings.bind('nightTimeStart', 'nightStart', (value) => {
      // For some reason this callback for timechoorser is called on every setting update so this workaround is required.
      if (this.opt.nightStart.h !== this.time.nightStart.h || this.opt.nightStart.m !== this.time.nightStart.m) {
        this.time.nightStart.h = this.opt.nightStart.h;
        this.time.nightStart.m = this.opt.nightStart.m;

        qLOG("NIGHT START", this.opt.nightStart);

        this.on_location_update();
        this.main_loop();
      }
    });
    this.settings.bind('nightTimeEnd', 'nightEnd', (value) => {
      // For some reason this callback for timechoorser is called on every setting update so this workaround is required.
      if (this.opt.nightEnd.h !== this.time.nightEnd.h || this.opt.nightEnd.m !== this.time.nightEnd.m) {
        this.time.nightEnd.h = this.opt.nightEnd.h;
        this.time.nightEnd.m = this.opt.nightEnd.m;

        qLOG("NIGHT END", this.opt.nightEnd);

        this.on_location_update();
        this.main_loop();
      }
    });

    this.time.nightStart.h = this.opt.nightStart.h;
    this.time.nightStart.m = this.opt.nightStart.m;
    this.time.nightEnd.h = this.opt.nightEnd.h;
    this.time.nightEnd.m = this.opt.nightEnd.m;


    this.settings.bind('locationRemote', 'locationRemote', this.on_setting_change.bind(this), {key: 'locationRemote'});
    this.settings.bind('locationCity', 'locationCity', this.on_setting_change.bind(this), {key: 'locationCity'});
    this.settings.bind('locationLatitude', 'locationLatitude', this.on_setting_change.bind(this), {key: 'locationLatitude'});
    this.settings.bind('locationLongitude', 'locationLongitude', this.on_setting_change.bind(this), {key: 'locationLongitude'});

    this.settings.bind("keyToggle", "keyToggle", this.on_shortcut_change.bind(this));
    this.settings.bind("keyBrightnessUp", "keyBrightnessUp", this.on_shortcut_change.bind(this));
    this.settings.bind("keyBrightnessDown", "keyBrightnessDown", this.on_shortcut_change.bind(this));
    this.settings.bind("keyTempUp", "keyTempUp", this.on_shortcut_change.bind(this));
    this.settings.bind("keyTempDown", "keyTempDown", this.on_shortcut_change.bind(this));
    this.settings.bind("keyGammaUp", "keyGammaUp", this.on_shortcut_change.bind(this));
    this.settings.bind("keyGammaDown", "keyGammaDown", this.on_shortcut_change.bind(this));


    this.settings.bind('stepBright', 'stepBright', this.on_setting_change.bind(this), {key: 'stepBright'});
    this.settings.bind('stepTemp', 'stepTemp', this.on_setting_change.bind(this), {key: 'stepTemp'});
    this.settings.bind('stepGamma', 'stepGamma', this.on_setting_change.bind(this), {key: 'stepGamma'});

    this.settings.bind('autoCheckUpdate', 'autoCheckUpdate', (v) => {qLOG('checkUpdateInterval', v);});
    this.settings.bind('checkUpdateInterval', 'checkUpdateInterval', (v) => {qLOG('checkUpdateInterval', v);});

    this.settings.bind('debugToggle', 'debug', (value) => {global.DEBUG = value;}, null);
    global.DEBUG = this.opt.debug;


    qLOG('checkUpdateInterval', this.opt.checkUpdateInterval);


    this.set_icon();
    this.set_applet_label("QRedshift Loading...");

    this.hide_applet_label(!this.opt.iconLabel);
    if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();


    qLOG("QRedshift", this.arch);

    this.maxBrightness = 100;
    this.minBrightness = 10;
    this.maxColor = 12000;
    this.minColor = 1000;


    this.menuManager = new PopupMenu.PopupMenuManager(this);
    this.menu = new Applet.AppletPopupMenu(this, orientation);
    this.menuManager.addMenu(this.menu);
    this.createPopup();

    this.current_temp = this.opt.dayTemp;

    // Reload BTN
    let reload_btn = new PopupMenu.PopupIconMenuItem(_("Reload Applet"), 'view-refresh-symbolic', QIcon.SYMBOLIC, {hover: true});
    reload_btn.connect('activate', this.reload_applet.bind(this));
    this._applet_context_menu.addMenuItem(reload_btn);
    // this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    if (global.DEBUG) {
      let generate_pot_btn = new PopupMenu.PopupIconMenuItem(_("Generate .POT file"), 'preferences-desktop-locale-symbolic', QIcon.SYMBOLIC, {hover: true});
      generate_pot_btn.connect('activate', this.make_pot_file.bind(this));
      this._applet_context_menu.addMenuItem(generate_pot_btn);
    }

    let recompile_btn = new PopupMenu.PopupIconMenuItem(_("Recompile Translations"), 'preferences-desktop-locale-symbolic', QIcon.SYMBOLIC, {hover: true});
    recompile_btn.connect('activate', this.recompile_translations.bind(this));
    this._applet_context_menu.addMenuItem(recompile_btn);



    this.actor.connect('scroll-event', (actor, event) => {
      // this.labelHidden = !this.labelHidden;
      // this.hide_applet_label(this.labelHidden);

      let action = this.opt.labelScrollAction;
      if (action === 'on_off') {
        let direction = event.get_scroll_direction();
        if (direction == 0 && !this.opt.enabled) {
          this.enabledDay.setToggleState(true);
          this.opt.enabled = true;
          this.main_loop();
        } else if (direction == 1 && this.opt.enabled) {
          this.enabledDay.setToggleState(false);
          this.opt.enabled = false;
          this.main_loop();
        }
      } else if (action === 'temp') {
        this.dc_Slider._onScrollEvent(actor, event);
      } else if (action === 'bright') {
        this.db_Slider._onScrollEvent(actor, event);
        this.nb_Slider._onScrollEvent(actor, event);
      } else if (action === 'gamma') {
        this.gm_Slider._onScrollEvent(actor, event);
      }

      // qLOG('Scroll', this.opt.labelScrollAction);
      //
      // let key = event.get_key_symbol();
      //
      // qLOG('Key', key);

    });


    // qLOG("KEY|");
    this.on_shortcut_change();
    this.on_location_update();


    if (this.archs.supported.includes(this.arch)) {
      // Make binary executable
      QUtils.spawn_command_line_sync_string_response(`chmod +x ${this.bin_path}`);

      // --- Async Loading ---
      QUtils.spawn_command_line_async_promise(`${this.bin_path} -v`, null, true).then(value => {
        qLOG("ASYNC LOADING", value);

        this.set_location(false);

        this.main_loop();
      }).catch(reason => {
        qLOG("ASYNC LOADING ERROR", reason);

        this.set_applet_label(_("Something went wrong!"));
        this.set_applet_tooltip(_("Something went wrong!"));
      });
    }


    this.check_update(false);

  }

  check_update(force = true) {
    if (!this.opt.autoCheckUpdate && !force) return;

    if (!force) {
      let now = new Date().getTime();
      let check_update_ms = this.opt.checkUpdateInterval * 60 * 1000;
      if ((this.last_update + check_update_ms) > now) {
        qLOG('Not checking update', this.opt.checkUpdateInterval);
        return;
      }
    }

    this.last_update = new Date().getTime();

    QUtils.spawn_command_line_async_promise(`curl -s ${UPDATE.remote_releases_url_quintao}`)
      .then(value => JSON.parse(value))
      .then(value => {
        let {tag_name, assets, body, message} = value;
        if (message) throw message;
        let {browser_download_url} = {browser_download_url: ''};

        if (assets.length > 0) {
          let asset = assets.find(a => a.name.endsWith('tar.gz'));
          if (asset) browser_download_url = asset['browser_download_url'];
        }


        let version = tag_name.replace(/^v/g, '');

        let version_number_local = parseInt(this.metadata.version.replace(/\./g, ''));
        let version_number_remote = parseInt(version.replace(/\./g, ''));

        qLOG("VERSION UDPATE", {version_number_local, version_number_remote});

        if (version_number_local < version_number_remote) {
          // QUtils.show_notification(_("New Version Available") + ` ${version}`, _('Check applet menu to update'), null, `${this.metadata.path}/icons/icon.svg`);
          QUtils.show_notification("QRedshift: " + _("New Version Available"), `${body}`, null, `${this.metadata.path}/icons/icon.svg`);

          if (this.menu_update == null) {
            let menu = new QPopupHeader({
              reactive:  true,
              activate:  false,
              label:     _("New Version Available") + ` ${version}`,
              sub_label: _("Click to Update"),
              iconPath:  `${this.metadata.path}/icons/update.svg`,
              iconSize:  32,
              tooltip:   _("Click to Update")
            });
            menu.connect('click', (actor, value) => {
              exec_update(menu, version, browser_download_url);
            }, true);
            this.menu_update = new PopupMenu.PopupMenuSection();
            this.menu_update.addMenuItem(menu);
            this.menu_update.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addMenuItem(this.menu_update, 4);
          }
        } else if (version_number_local == version_number_remote && force) {
          QUtils.show_notification(`QRedshift`, _('You are running the latest version.'), null, `${this.metadata.path}/icons/icon.svg`);
        }

      }).catch(reason => {
      if (force) {
        qLOG("VERSION UDPATE: Failed to check updates", JSON.stringify(reason));
        QUtils.show_error_notification(_('Failed to check updates') + "\n" + _('Api Limit Exceeded'));
      }
    });


    /**
     * @param {QGui.QPopupHeader} menu
     * @param new_version
     * @param browser_download_url
     * @return {Promise<void>}
     */
    let exec_update = async (menu, new_version, browser_download_url) => {
      let delay = 350;

      let target = HOME + "/.local/share/cinnamon/applets";
      qLOG("VERSION UDPATE", target);

      menu.setLabel(_('Updating! Your system may freeze for a few seconds.'));
      menu.setSubLabel(_('Downloading files...'));
      await QUtils.delay(delay);
      QUtils.spawn_command_line_async_promise(`curl -sS -o ${target}/tmp.tar.gz -L ${browser_download_url}`, null, false)
        .then(async value => {
          menu.setSubLabel(_('Installing...'));
          await QUtils.delay(delay);
          QUtils.spawn_command_line_async_promise(`tar -xzf ${target}/tmp.tar.gz -C ${target}`, null, false)
            .then(async value => {
              QUtils.spawn_command_line_async_promise(`rm ${target}/tmp.tar.gz`, null, false)
                .then(async value => {
                  menu.setSubLabel(_('Reloading Applet...'));
                  await QUtils.delay(delay);
                  QUtils.show_notification(`${this.metadata.name} ` + _('Updated successfully'), _('Version installed') + `: ${new_version}`, undefined, `${this.metadata.path}/icons/icon.svg`);
                  this.menu.close(true);
                  await QUtils.delay(50);
                  this.reload_applet();
                }).catch(reason => {
                menu.setSubLabel(_('Update failed'));
                qLOG('VERSION UDPATE', 'Failed to download update!', JSON.stringify(reason));
              });

            }).catch(reason => {
            menu.setSubLabel(_('Update failed'));
            qLOG('VERSION UDPATE', 'Failed to download update!', JSON.stringify(reason));
          });
        }).catch(reason => {
        menu.setSubLabel(_('Failed to download update!'));
        qLOG('VERSION UDPATE', 'Failed to download update!', JSON.stringify(reason));
      });

      // QUtils.spawn_command_line_sync_string_response(`bash ${this.metadata.path}/bin/install.sh`);

    };
  }

  /**
   * @typedef {{period: ('day'|'night'|'transition_to_day'|'transition_to_night'), is_night: boolean, percent: number}} check_period_return
   */
  /**
   * @return {check_period_return}
   */
  check_period() {
    let date = new Date();
    let d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());

    let date_s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.time.nightStart.h, this.time.nightStart.m, 0);
    let date_e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.time.nightEnd.h, this.time.nightEnd.m, 0);

    let date_st = new Date(date_s.getTime() + this.opt.transitionDuration * 60000);
    let date_et = new Date(date_e.getTime() + this.opt.transitionDuration * 60000);


    let night = false;
    let percent = 0.0;
    let period = '';
    let debug = {};

    if (date_s <= date_e) {
      night = d >= date_s && d <= date_e;
    } else if (date_s > date_e && d >= date_s) {
      night = d >= date_s;
    } else {
      night = d < date_e;
    }

    if (this.opt.smoothTransition) {
      function rule_of_three(partial, total) {
        return partial * 100 / total / 100;
      }


      if (night) {
        percent = rule_of_three(d.getTime() - date_s.getTime(), date_st.getTime() - date_s.getTime());
      } else {
        percent = rule_of_three(d.getTime() - date_e.getTime(), date_et.getTime() - date_e.getTime());
      }
      percent = 1 - percent;

      debug = {
        d:       d.toLocaleTimeString('pt-br'),
        date_s:  date_s.toLocaleTimeString('pt-br'),
        date_st: date_st.toLocaleTimeString('pt-br'),
        date_e:  date_e.toLocaleTimeString('pt-br'),
        date_et: date_et.toLocaleTimeString('pt-br'),
        percent: percent
      };

      if (percent > 1.0) percent = 0;
      else if (percent < 0) percent = 0;

      if (night) {
        period = 'night';
        period = (percent > 0 && percent < 1) ? 'transition_to_night' : 'night';
      } else {
        period = 'day';
        period = (percent > 0 && percent < 1) ? 'transition_to_day' : 'day';
      }

    }
    let response = {'period': period, 'is_night': night, 'percent': percent, 'debug': debug};

    // qLOG('check_period', response);

    return response;
  }



  set_icon() {
    // qLOG('ICON', this.opt.symbolicIcon);

    if (this.opt.symbolicIcon) {
      if (this.opt.enabled)
        // this.set_applet_icon_symbolic_path(`${this.metadata.path}/icons/` + "qredshift_s.svg");
        this.set_applet_icon_symbolic_name('qredshift-on-symbolic');
      else
        // this.set_applet_icon_symbolic_path(`${this.metadata.path}/icons/` + "qredshift_s.svg");
        this.set_applet_icon_symbolic_name('qredshift-off-symbolic');
      // this.set_applet_icon_symbolic_name(ICONS.S_ICON_OFF);
    } else {
      // this.set_applet_icon_symbolic_path('');
      if (this.opt.enabled)
        this.set_applet_icon_path(`${this.metadata.path}/icons/` + 'qredshift.svg');
      else
        this.set_applet_icon_path(`${this.metadata.path}/icons/` + 'qredshift-off.svg');
      // this.set_applet_icon_path(`${this.metadata.path}/icons/` + ICONS.S_ICON_OFF);
    }

    if (this.opt.enabled) {
      if (this.headerIcon) this.headerIcon.setIconPath(this.metadata.path + '/icons/qredshift.svg');
    } else {
      if (this.headerIcon) this.headerIcon.setIconPath(this.metadata.path + '/icons/qredshift-off.svg');
    }
  }

  disable_redshift_service() {
    // qLOG('disable_redshift_service');

    QUtils.spawn_command_line_async_promise("systemctl is-enabled --user redshift").then(value => {
      // qLOG('Redshift Service', value);
      if (value === 'enabled') {
        QUtils.spawn_command_line_sync_string_response('systemctl mask --user redshift');
        qLOG('QRedshift', 'Disabling Service');
      }
    });

    QUtils.spawn_command_line_async_promise("systemctl is-active --user redshift").then(value => {
      // qLOG('Redshift Service', value);
      if (value === 'active') {
        Util.spawn_command_line_sync_string_response('systemctl stop --user redshift');
        qLOG('QRedshift', 'Stopping Service');
      }
    });
  }

  check_old_redshift() {
    QUtils.spawn_command_line_async_promise('redshift -V').then(value => {
      // qLOG('OLD REDSHIFT', value);

      if (this.redshift_info_menu_item == null) {
        this.redshift_info_menu_item = new QPopupHeader({
          reactive:  true,
          label:     "redshift",
          sub_label: _("package can be removed."),
          iconName:  "dialog-information-symbolic", //dialog-warning-symbolic
          iconSize:  18,
          tooltip:   _("Old Redshift package is no longer required and can be safely removed.")
        });
        this.menu_info_section.addMenuItem(this.redshift_info_menu_item, 4);
      }

      this.disable_redshift_service();

    }).catch(reason => {
      // qLOG('OLD REDSHIFT ERROR', reason);
      if (this.redshift_info_menu_item !== null) {
        this.menu_info_section.removeChildMenu(this.redshift_info_menu_item);
        this.redshift_info_menu_item.destroy();
        this.redshift_info_menu_item = null;
      }
    });
  }

  check_conflicts() {
    if (this.wayland && !this.menu_wayland_info) {
      this.set_applet_label(_("Not supported on wayland!"));
      this.menu_wayland_info = new QPopupHeader({
        reactive:  true,
        label:     "Wayland",
        sub_label: _("Not supported on wayland!"),
        iconName:  "dialog-error", //dialog-warning-symbolic
        iconSize:  18,
        tooltip:   _("Automatically disabled under Wayland due to cinnamon compositor not yet support gamma ramps change.")
      });
      this.menu_info_section.addMenuItem(this.menu_wayland_info, 4);
    }

    if (!this.archs.supported.includes(this.arch) && !this.menu_arch_info) {
      this.set_applet_label(_("Unsupported architecture") + ` ${this.arch}`);
      // this.hide_applet_label(false);
      this.menu_arch_info = new QPopupHeader({
        reactive:  true,
        activate:  true,
        label:     this.arch,
        sub_label: _("Unsupported architecture"),
        iconName:  "dialog-error", //dialog-warning-symbolic
        iconSize:  18,
        tooltip:   _("Unsupported architecture, click here to report.")
      });
      this.menu_arch_info.connect('click', (actor, value) => {
        this.open_project_issue_page();
      }, true);

      this.menu_info_section.addMenuItem(this.menu_arch_info, 4);
    }

    this.check_old_redshift();
  }

  set_location(force = true) {
    qLOG('QRedshift', 'set_location');

    if (!this.opt.locationRemote) return;

    if (!force && this.opt.locationLatitude != "0" && this.opt.locationLongitude != "0") return;

    let url = 'https://geoip.fedoraproject.org/city';
    // url = 'https://geolocation-db.com/json/';


    QUtils.spawn_command_line_async_promise(`curl -s ${url}`).then(value => {
      let {city, country_name, latitude, longitude} = JSON.parse(value);
      this.opt.locationLatitude = `${latitude}`;
      this.opt.locationLongitude = `${longitude}`;
      this.opt.locationCity = `${city}`;
      qLOG('Location Response', value);

      this.on_location_update();

    }).catch(reason => {
      qLOG('Location Error', reason);
      this.opt.city = 'error';

      this.opt.locationLatitude = `0`;
      this.opt.locationLongitude = `0`;
      this.opt.locationCity = `-`;

      this.on_location_update();
      if (force) {
        QUtils.show_error_notification(_("Error searching for your location"));
      }

    });

  }


  on_shortcut_change() {
    if (this.opt.keyBrightnessUp)
      Main.keybindingManager.addHotKey("keyBrightnessUp", this.opt.keyBrightnessUp, (event) => {
        this.db_Slider._setValueEmit(this.db_Slider.value + this.opt.stepBright);
        this.nb_Slider._setValueEmit(this.nb_Slider.value + this.opt.stepBright);
      });

    if (this.opt.keyBrightnessDown)
      Main.keybindingManager.addHotKey("keyBrightnessDown", this.opt.keyBrightnessDown, (event) => {
        this.db_Slider._setValueEmit(this.db_Slider.value - this.opt.stepBright);
        this.nb_Slider._setValueEmit(this.nb_Slider.value - this.opt.stepBright);
      });

    if (this.opt.keyTempUp)
      Main.keybindingManager.addHotKey("keyTempUp", this.opt.keyTempUp, (event) => {
        this.dc_Slider._setValueEmit(this.dc_Slider.value + this.opt.stepTemp);
        this.nc_Slider._setValueEmit(this.nc_Slider.value + this.opt.stepTemp);
      });

    if (this.opt.keyTempDown)
      Main.keybindingManager.addHotKey("keyTempDown", this.opt.keyTempDown, (event) => {
        this.dc_Slider._setValueEmit(this.dc_Slider.value - this.opt.stepTemp);
        this.nc_Slider._setValueEmit(this.nc_Slider.value - this.opt.stepTemp);
      });

    if (this.opt.keyGammaUp)
      Main.keybindingManager.addHotKey("keyGammaUp", this.opt.keyGammaUp, (event) => {
        this.gm_Slider._setValueEmit(this.gm_Slider.value + this.opt.stepGamma);
      });

    if (this.opt.keyGammaDown)
      Main.keybindingManager.addHotKey("keyGammaDown", this.opt.keyGammaDown, (event) => {
        this.gm_Slider._setValueEmit(this.gm_Slider.value - this.opt.stepGamma);
      });

    if (this.opt.keyToggle)
      Main.keybindingManager.addHotKey("keyToggle", this.opt.keyToggle, (event) => {
        this.opt.enabled = !this.opt.enabled;
        this.enabledDay.setToggleState(this.opt.enabled);
        this.main_loop();
      });


  }

  /**
   * @param {any} value
   * @param {{key: string}} data
   */
  on_setting_change(value = '', data = {key: undefined}) {
    qLOG("onSettChange", value, data);

    this.enabledAuto.setToggleState(this.opt.autoUpdate);

    // Day Enabled
    this.enabledDay.setToggleState(this.opt.enabled);

    // Day Temp
    this.dc_Slider.setValue(this.opt.dayTemp);
    this.dc_Slider.setStep(this.opt.stepTemp);

    // Day Bright
    this.db_Slider.setValue(this.opt.dayBrightness);
    this.db_Slider.setStep(this.opt.stepBright);

    // Gamma mix
    this.gm_Slider.setValue(this.opt.gammaMix);
    this.gm_Slider.setStep(this.opt.stepGamma);

    // Night Enabled
    this.enabledNight.setToggleState(this.opt.enabledNight);

    // Night Temp
    this.nc_Slider.setValue(this.opt.nightTemp);
    this.nc_Slider.setStep(this.opt.stepTemp);

    // Night Bright
    this.nb_Slider.setValue(this.opt.nightBrightness);
    this.nb_Slider.setStep(this.opt.stepBright);

    this.on_location_update();

    this.main_loop();
  }

  on_location_update() {
    qLOG('on_location_update');

    let calc = new QSunCalc.SunCalc();

    let regex = /^-?\d+(\.\d+)/;

    if (this.opt.locationLatitude.match(regex) && this.opt.locationLongitude.match(regex)) {
      let info = calc.getTimes(new Date(), parseFloat(this.opt.locationLatitude), parseFloat(this.opt.locationLongitude));
      let sunset = info.sunset.toLocaleTimeString();
      let sunrise = info.sunrise.toLocaleTimeString();

      if (!this.opt.manualNightTime) {
        this.opt.nightStart.h = info.sunset.getHours();
        this.opt.nightStart.m = info.sunset.getMinutes();
        this.opt.nightStart.save();

        this.opt.nightEnd.h = info.sunrise.getHours();
        this.opt.nightEnd.m = info.sunrise.getMinutes();
        this.opt.nightEnd.save();

        this.time.nightStart.h = this.opt.nightStart.h;
        this.time.nightStart.m = this.opt.nightStart.m;
        this.time.nightEnd.h = this.opt.nightEnd.h;
        this.time.nightEnd.m = this.opt.nightEnd.m;
      }
    }
    if (this.menu_location) this.menu_location.set_city_text(this.opt.locationCity);

    let d = new Date();
    let date_s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.time.nightStart.h, this.time.nightStart.m, 0);
    let date_e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.time.nightEnd.h, this.time.nightEnd.m, 0);

    if (this.menu_location) this.menu_location.set_sunset_text(date_s.toLocaleTimeString(undefined, {timeStyle: 'short'}));
    if (this.menu_location) this.menu_location.set_sunrise_text(date_e.toLocaleTimeString(undefined, {timeStyle: 'short'}));
  }


  createPopup() {
    this.headerIcon = new QPopupHeader({
      label:     this.metadata.name,
      sub_label: `${this.metadata.version}`,
      iconPath:  this.metadata.path + '/icons/qredshift.svg',
      iconSize:  50
    });
    this.menu.addMenuItem(this.headerIcon, 0);

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu_location = new QPopupLocation({
      city:            this.opt.locationCity,
      sunrise_text:    '-',
      sunset_text:     '-',
      sunset_tooltip:  _("Sunset"),
      sunrise_tooltip: _("Sunrise"),
      sunrise_icon:    'sunrise-symbolic',
      sunset_icon:     'sunset-symbolic',
      icon_size:       18
    });
    this.menu.addMenuItem(this.menu_location);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    this.menu_info_section = new PopupMenu.PopupMenuSection();
    this.menu.addMenuItem(this.menu_info_section);

    // region -- DAY Settings --

    this.enabledDay = new QPopupSwitch({
      label:  _("Enabled"),
      active: this.opt.enabled
    });
    this.enabledDay.connect('toggled', this.dayEnabledChange.bind(this));
    this.menu.addMenuItem(this.enabledDay);

    // day color
    this.dc_Slider = new QPopupSlider({
      label: _("Temp:"), unit: 'K',
      value: this.opt.dayTemp, min: this.minColor, max: this.maxColor, step: this.opt.stepTemp
    });
    this.dc_Slider.connect('value-changed', this.dayColorChange.bind(this));
    this.dc_Slider.connect('right-click', (actor, value) => {
      actor._setValueEmit('6500');
    });
    this.menu.addMenuItem(this.dc_Slider);

    // day bright
    this.db_Slider = new QPopupSlider({
      label: _("Bright:"), unit: '%',
      value: this.opt.dayBrightness, min: this.minBrightness, max: 100, step: this.opt.stepBright
    });
    this.db_Slider.connect('value-changed', this.dayBrightChange.bind(this));
    this.db_Slider.connect('right-click', (actor, value) => {
      actor._setValueEmit('100');
    });
    this.menu.addMenuItem(this.db_Slider);

    // Gamma
    this.gm_Slider = new QPopupSlider({
      label: _("Gamma:"), unit: '',
      value: this.opt.gammaMix, min: 0.5, max: 5, step: this.opt.stepGamma
    });
    this.gm_Slider.connect('value-changed', this.gammaMixChange.bind(this));
    this.gm_Slider.connect('right-click', (actor, value) => {
      actor._setValueEmit(1);
    });
    this.menu.addMenuItem(this.gm_Slider);
    // endregion

    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // region -- Night Settings --

    this.enabledNight = new QPopupSwitch({
      label:  _("Night Enabled"),
      active: this.opt.enabledNight
    });
    this.enabledNight.connect('toggled', this.nightEnabledChange.bind(this));
    this.menu.addMenuItem(this.enabledNight);

    // night color
    this.nc_Slider = new QPopupSlider({
      label: _("Temp:"), unit: 'K',
      value: this.opt.nightTemp, min: this.minColor, max: this.maxColor, step: this.opt.stepTemp
    });
    this.nc_Slider.connect('value-changed', this.nightColorChange.bind(this));
    this.nc_Slider.connect('right-click', (actor, value) => {
      actor._setValueEmit('3500');
    });
    this.menu.addMenuItem(this.nc_Slider);

    // night bright
    this.nb_Slider = new QPopupSlider({
      label: _("Bright:"), unit: '%',
      value: this.opt.nightBrightness, min: this.minBrightness, max: 100, step: this.opt.stepBright
    });
    this.nb_Slider.connect('value-changed', this.nightBrightChange.bind(this));
    this.nb_Slider.connect('right-click', (actor, value) => {
      actor._setValueEmit('100');
    });
    this.menu.addMenuItem(this.nb_Slider);
    // endregion



    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


    // region -- Bottom Bar --
    this.bottomBar = new QPopupIconBar();
    this.menu.addMenuItem(this.bottomBar);

    // config button
    let configBtn = new QIcon({
      style_class: 'popup-menu-item',
      icon_name:   'system-run-symbolic',
      icon_size:   20,
      icon_type:   QIcon.SYMBOLIC,
      reactive:    true, activate: true, hover: true
    });
    configBtn.add_style_class_name('q-icon');
    configBtn.connect('activate', (actor, value) => {
      this.configureApplet();
      this.menu.close();
    });
    this.bottomBar.addOnRight(configBtn);

    // auto update
    this.enabledAuto = new QPopupSwitch({
      label:  this.settings.getDesc('autoUpdate'),
      active: this.opt.autoUpdate
    });
    this.enabledAuto.actor.add_style_class_name('q-icon');
    this.enabledAuto.connect('toggled', this.autoUpdateChange.bind(this));
    // this.bottomBar.addOnLeft(this.enabledAuto);
    //
    // show label
    this.enabledLabel = new QPopupSwitch({
      label:  _("Show Label"),
      active: this.opt.iconLabel
    });
    this.enabledLabel.actor.add_style_class_name('q-icon');
    this.enabledLabel.connect('toggled', () => {
      this.opt.iconLabel = !this.opt.iconLabel;
      this.hide_applet_label(!this.opt.iconLabel);
      if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
    });
    // this._applet_context_menu.addMenuItem(this.enabledLabel);

    this.bottomBar.addOnLeft(this.enabledLabel);
    // endregion
  }

  //region -- ON Slider Changes --
  autoUpdateChange(switcher, value) {
    // this.opt.locationCity = 'asd';
    // this.opt.autoUpdate = value;
    // this.doUpdate();
  }

  dayEnabledChange(switcher, value) {
    // qLOG('Day Change', value);
    this.opt.enabled = value;
    this.main_loop();
  }

  dayColorChange(slider, value) {
    // qLOG('Day Color Change', value);
    this.opt.dayTemp = value;
    this.main_loop();
  }

  dayBrightChange(slider, value) {
    // qLOG('Day Bright Change', value);
    this.opt.dayBrightness = value;
    this.main_loop();
  }

  gammaMixChange(slider, value) {
    // qLOG('Gamma Change', value);
    this.opt.gammaMix = value;
    this.main_loop();
  }


  nightEnabledChange(switcher, value) {
    // qLOG('Night Change', value);
    this.opt.enabledNight = value;
    this.main_loop();
  }

  nightColorChange(slider, value) {
    // qLOG('Night Color Change', value);
    this.opt.nightTemp = value;
    this.main_loop();
  }

  nightBrightChange(slider, value) {
    // qLOG('Night Bright Changee', value);
    this.opt.nightBrightness = value;
    this.main_loop();
  }

  //endregion


  on_applet_added_to_panel() {
    qLOG('QRedshift', 'ADDED TO PANEL');
    if (this.wayland)
      this.opt.enabled = false;
    else if (this.opt.enableAtStartup === true) {
      this.opt.enabled = true;
      this.enabledDay.setToggleState(this.opt.enabled);
    }
    this.check_conflicts();
  }


  on_applet_clicked(event) {
    this.check_conflicts();
    this.menu.toggle();
  }

  on_applet_removed_from_panel() {
    qLOG('QRedshift', 'REMOVED FROM PANEL');
    Main.keybindingManager.removeHotKey("keyToggle");
    Main.keybindingManager.removeHotKey("keyBrightnessUp");
    Main.keybindingManager.removeHotKey("keyBrightnessDown");
    Main.keybindingManager.removeHotKey("keyTempUp");
    Main.keybindingManager.removeHotKey("keyTempDown");
    Main.keybindingManager.removeHotKey("keyGammaUp");
    Main.keybindingManager.removeHotKey("keyGammaDown");
    if (this.timeout) {
      Mainloop.source_remove(this.timeout);
      this.timeout = undefined;
    }
    this.settings.finalize();

    this.command_restore();
  }

  main_loop() {
    qLOG("MAIN LOOP");

    this.check_update(false);

    this.update();

    if (this.wayland || !this.archs.supported.includes(this.arch)) return;

    if (this.timeout) {
      Mainloop.source_remove(this.timeout);
      this.timeout = undefined;
    }

    if (this.opt.enabled && this.opt.autoUpdate && this.opt.enabledNight) {
      this.timeout = Mainloop.timeout_add_seconds(this.opt.autoUpdateInterval, this.main_loop.bind(this), null);
      // qLOG('auto update', this.opt.autoUpdateInterval);
    }
  }

  update() {
    qLOG("UPDATE!", this.opt.enabled);

    // if (this.opt.enabled) {

    let temp = this.opt.dayTemp;
    let brigh = this.opt.dayBrightness;

    let prd = null;
    if (this.opt.enabled && this.opt.enabledNight) {
      prd = this.check_period();
      if (prd.is_night) {
        temp = lerp(this.opt.nightTemp, this.opt.dayTemp, prd.percent);
        brigh = lerp(this.opt.nightBrightness, this.opt.dayBrightness, prd.percent);
      } else {
        temp = lerp(this.opt.dayTemp, this.opt.nightTemp, prd.percent);
        brigh = lerp(this.opt.dayBrightness, this.opt.nightBrightness, prd.percent);
      }
      // qLOG('Temp', temp, `Period: ${prd.period}, Percent: ${prd.percent}`);

    }

    this.current_temp = temp;
    this.current_brightness = brigh;
    this.current_gamma = this.opt.gammaMix;

    if (this.opt.enabled) {
      this.command_update(this.current_temp, this.current_brightness / 100, this.current_gamma);
    } else {
      this.command_restore();
    }


    this.update_header_info(prd);
    this.update_tooltip_and_label(prd);
    this.set_icon();
  }

  command_update(temp, bright, gamma) {
    if (this.wayland) {
      qLOG("QRedshift", "Wayland not supported");
      return;
    }
    if (!this.archs.supported.includes(this.arch)) {
      qLOG("QRedshift", `Architeture '${this.arch}' not supported`);
      return;
    }
    Util.spawnCommandLine(`${this.bin_path} -t ${temp} -b ${bright} -g ${gamma}`);
  }

  command_restore() {
    if (this.wayland) {
      qLOG("QRedshift", "Wayland not supported");
      return;
    }
    if (!this.archs.supported.includes(this.arch)) {
      qLOG("QRedshift", `Architeture '${this.arch}' not supported`);
      return;
    }
    // QUtils.spawn_command_line_sync_string_response(`${this.bin_path} -t`);
    Util.spawnCommandLine(`${this.bin_path} -t`);
  }

  /**
   * @param {check_period_return | null} prd
   */
  update_header_info(prd) {
    let period = this.opt.period + "";

    if (!prd || !this.enabledNight) this.headerIcon.setStatus("-");

    if (this.opt.enabled && this.opt.enabledNight && prd !== null) {
      if (prd.period == 'transition_to_day') period = _("Transition to day");
      else if (prd.period == 'transition_to_night') period = _("Transition to night");
      else if (prd.period == 'night') period = _("Night");
      else if (prd.period == 'day') period = _("Day");
      // else if (prd.is_night) period = _("Night");
      // else period = _("Day");

      if (this.opt.smoothTransition) {
        let p = (100 - prd.percent * 100).toFixed(0);
        if (p < 100) period += ` (${p}%)`;
        this.headerIcon.setStatus(period + "");
      } else this.headerIcon.setStatus(period + "");
    } else this.headerIcon.setStatus("-");
  }

  /**
   * @param {check_period_return | null} prd
   */
  update_tooltip_and_label(prd) {
    let tooltiptext = `${this.metadata.name}: ${this.opt.enabled ? _("On") : _("Off")}`;
    let labeltext = _("Off");

    if (this.opt.enabled) {
      tooltiptext += '\n';
      let period = this.opt.period;
      if (this.opt.enabledNight && prd != null) {
        if (prd.period == 'transition_to_day') period = _("Transition to day");
        else if (prd.period == 'transition_to_night') period = _("Transition to night");
        else if (prd.period == 'night') period = _("Night");
        else if (prd.period == 'day') period = _("Day");
      }
      if (this.opt.smoothTransition && this.opt.nightTemp && prd != null) {
        let p = (100 - prd.percent * 100).toFixed(0);
        if (p < 100) period += ` (${p}%)`;

        tooltiptext += `${period}\n\n`;
      } else {
        tooltiptext += `${period}\n\n`;
      }

      if (this.opt.enabledNight) {
        tooltiptext += _("Day Temperature") + ": " + `${this.opt.dayTemp}K\n`;
        tooltiptext += _("Day Brightness") + ": " + `${this.opt.dayBrightness}%\n`;

        tooltiptext += _("Night Temperature") + ": " + `${this.opt.nightTemp}K\n`;
        tooltiptext += _("Night Brightness") + ": " + `${this.opt.nightBrightness}%\n`;
      } else {
        tooltiptext += _("Temperature") + ": " + `${this.opt.dayTemp}K\n`;
        tooltiptext += _("Brightness") + ": " + `${this.opt.dayBrightness}%\n`;
      }
      tooltiptext += _("Gamma:") + " " + `${this.opt.gammaMix}`;

      // Label text

    }
    if (this.opt.enabledNight && this.check_period().is_night) {
      labeltext = `${this.current_temp}k - ${this.current_brightness}% - `;
    } else {
      labeltext = `${this.current_temp}k - ${this.current_brightness}% - `;
    }
    labeltext += `${this.opt.gammaMix.toFixed(2)}`;

    this.set_applet_tooltip(tooltiptext);

    this.set_applet_label(labeltext);
    this.hide_applet_label(!this.opt.iconLabel);
    if (!this.opt.enabled && !this.opt.iconLabelAlways) this.hideLabel();
  }

  open_project_page() {
    // QUtils.spawn_command_line_sync_string_response("xdg-open https://github.com/raphaelquintao/QRedshiftCinnamon");
    Util.spawnCommandLine("xdg-open https://github.com/raphaelquintao/QRedshiftCinnamon");
  }

  open_project_issue_page() {
    // QUtils.spawn_command_line_sync_string_response("xdg-open https://github.com/raphaelquintao/QRedshiftCinnamon/issues");
    Util.spawnCommandLine("xdg-open https://github.com/raphaelquintao/QRedshiftCinnamon/issues");
  }

  debug_toggle() {
    global.DEBUG = !global.DEBUG;
  }

  make_pot_file() {
    // qLOG('Make Pot File', this.metadata.path);
    // QUtils.show_info_notification('make pot');
    let cmd = `cinnamon-xlet-makepot .`;
    QUtils.spawn_command_line_async_promise(cmd, this.metadata.path).then(resp => {
      qLOG(resp);
      if (resp.match(/polib/)) {
        QUtils.show_error_notification(resp);
      } else {
        QUtils.show_info_notification(resp);
      }
    }).catch(reason => {
      QUtils.show_error_notification(reason);
    });
  }

  // Cinnamon should be restarted after this.
  recompile_translations() {
    // Remove installed translations
    let cmd = `cinnamon-xlet-makepot -r ${this.metadata.path}`;
    let resp = QUtils.spawn_command_line_sync_string_response(cmd);
    let success = true;
    if (resp.success && resp.stdout) {
      if (resp.stdout.match(/polib/g)) {
        qLOG('Recompile translations!', resp);
        success = false;
        QUtils.show_error_notification(resp.stdout);
      }
    }
    if (success) {
      // Reinistall translations
      cmd = `cinnamon-xlet-makepot -i ${this.metadata.path}`;
      resp = QUtils.spawn_command_line_sync_string_response(cmd);
      if (resp.success && resp.stdout) {
        QUtils.show_info_notification(resp.stdout);
      }
    }
  }

  reload_applet() {
    let cmd = `dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'${this.metadata.uuid}' string:'APPLET'`;
    // QUtils.spawn_command_line_sync_string_response(cmd);
    Util.spawnCommandLine(cmd);
  }

  open_settings() {
    Util.spawnCommandLine("xlet-settings applet " + this._uuid + " " + this.instance_id);
  }

}


function main(metadata, orientation, panel_height, instance_id) {
  return new QRedshift(metadata, orientation, panel_height, instance_id);
}
