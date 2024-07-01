const Cinnamon = imports.gi.Cinnamon;
const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Atk = imports.gi.Atk;
const Signals = imports.signals;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;

/** @type QUtils */
const QUtils = require('./lib/QUtils.js');
const qLOG = QUtils.qLOG;

/**
 * @typedef QGui
 * @exports QGui
 */

/** @exports QGui.QIcon */
class QIcon {
    static get FULLCOLOR() { return St.IconType.FULLCOLOR;}
    
    static get SYMBOLIC() { return St.IconType.SYMBOLIC;}
    
    constructor({
        style_class = null, icon_name = null, icon_path = null, icon_size = 32, icon_type = null,
        reactive = false, activate = false, hover = true, can_focus = true, focusOnHover = true
    } = {}) {
        
        
        this._stIcon = new St.Icon({
            style_class, icon_name, icon_type, icon_size,
            reactive, hover, can_focus, track_hover: true
        });
        
        this.active = false;
        this.focusOnHover = focusOnHover;
        
        
        if (icon_path != null) this.iconPath = icon_path;
        
        
        
        if (activate) {
            this._stIcon.connect('button-release-event', (actor, event) => {
                let button = event.get_button();
                if (button == 1) this.activate(event, false);
                if (button == 3) this.emit('right-click', event, false);
            });
        }
        
        if (reactive && hover) {
            this._stIcon.connect('notify::hover', (actor) => {
                this.setActive(actor.hover);
            });
        }
        if (reactive) {
            this._stIcon.connect('key-focus-in', (actor) => {this.setActive(true);});
            this._stIcon.connect('key-focus-out', (actor) => {this.setActive(false);});
        }
    }
    
    
    set iconPath(icon_path) {
        try {
            let file = Gio.file_new_for_path(icon_path);
            let ficon = new Gio.FileIcon({file: file});
            this._stIcon.set_gicon(ficon);
        } catch (e) {
            global.log(e);
        }
    }
    
    get iconName() { return this._stIcon.get_icon_name(); }
    
    set iconName(name) { this._stIcon.set_icon_name(name); }
    
    get iconSize() { return this._stIcon.get_icon_size(); }
    
    set iconSize(size) { this._stIcon.set_icon_size(size); }
    
    /** @returns {Gio.Icon} */
    get stIcon() { return this._stIcon; }
    
    /** @returns {Gio.Icon} */
    get actor() { return this._stIcon; }
    
    
    /** @param {QIcon.FULLCOLOR|QIcon.SYMBOLIC}  type */
    setIconType(type) {
        this._stIcon.set_icon_type(type);
    }
    
    set_style(style) { this._stIcon.set_style(style);}
    
    add_style_class_name(class_name) {this._stIcon.add_style_class_name(class_name);}
    
    // Events
    
    setActive(active) {
        if (active != this.active) {
            this.active = active;
            this._stIcon.change_style_pseudo_class('active', active);
            if (this.focusOnHover && this.active) this._stIcon.grab_key_focus();
            this.emit('active-changed', active);
        }
    }
    
    activate(event, keepMenu) {
        this.emit('activate', event, keepMenu);
    }
    
    destroy() {
    
    }
    
}

Signals.addSignalMethods(QIcon.prototype);

/** @exports QUtils.QPopupItem */
class QPopupItem extends PopupMenu.PopupBaseMenuItem {
    constructor({
        reactive = true, activate = false, sensitive = true,
        hover = true, focusOnHover = true, style_class = '',
        replace_class = false, tooltip = ''
    } = {}) {
        super({reactive, activate, sensitive, hover, focusOnHover, style_class});
        
        if (style_class && replace_class) this.actor.style_class = style_class;
        
        this._tooltip = new Tooltips.Tooltip(this.actor, tooltip);
    }
    
    set_tooltip(text) {
        this._tooltip.set_text(text);
    }
}


/** @exports QGui.QPopupHeader */
class QPopupHeader extends QPopupItem {
    texts = {
        label: "",
        sub_label: "",
        status: "",
        tooltip: ""
    };
    
    constructor({reactive = false, activate = false, style_class = '', replace_class = false, label = '', sub_label = '', status = '', iconPath, iconName = 'quintao', iconSize = 32, tooltip = ''}) {
        super({reactive: reactive, activate: activate, style_class: style_class, replace_class: replace_class});
        
        if (iconPath) {
            this._icon = new QIcon({icon_size: iconSize, icon_path: iconPath});
        } else {
            this._icon = new QIcon({icon_size: iconSize, icon_name: iconName});
        }
        this.texts.label = label;
        this.texts.sub_label = sub_label;
        this.texts.status = status;
        this.texts.tooltip = tooltip;
        
        this._label = new St.Label({text: label});
        this._label.add_style_class_name('q-text-bigger');
        this._label.add_style_class_name('q-text-bold');
        
        this._sub_label = new St.Label({text: sub_label});
        this._sub_label.add_style_class_name('q-text-smaller');
        
        this._status_text = new St.Label({text: status});
        this._status_text.add_style_class_name('q-text-smaller');
        this._status_text.add_style_class_name('q-header-status');
        
        this._tooltip = new Tooltips.Tooltip(this.actor, tooltip);
        
        // this.actor.style_class = `${this.actor.style_class} q-debug`;
        // this.base_style = this.actor.style_class;
        
        this._content_left = new PopupMenu.PopupMenuSection();
        this._content_left.addActor(this._label);
        this._content_left.addActor(this._sub_label);
        
        
        // Fixed content
        if ((iconPath || iconName) && !this._has_child(this._icon.actor))
            this.addActor(this._icon.actor, {span: 0, expand: false});
        
        this.addActor(this._content_left.actor, {span: 0, expand: false});
    }
    
    
    _set_actors() {
        // if (this.texts.label != '') {
        //     if (!this._has_child(this._label)) this.addActor(this._label, {span: 0, expand: false});
        // } else if (this._has_child(this._sub_label)) this.removeActor(this._label);
        
        // if (this.texts.sub_label != '') {
        //     if (!this._has_child(this._sub_label)) this.addActor(this._sub_label, {span: 0, expand: false});
        // } else if (this._has_child(this._sub_label)) this.removeActor(this._sub_label);
        
        if (this.texts.status != '') {
            if (!this._has_child(this._status_text)) this.addActor(this._status_text, {span: -1, expand: false, align: St.Align.END});
        } else if (this._has_child(this._status_text)) this.removeActor(this._status_text);
    }
    
    _has_child(item) {
        return this._children.find(value => value.actor == item) !== undefined;
    }
    
    setIconPath(path) {
        this._icon.iconPath = path;
    }
    
    setIconSize(size) {
        this._icon.iconSize = size;
    }
    
    
    setLabel(text = '') {
        this.texts.label = text;
        this._label.set_text(text);
        this._set_actors();
    }
    
    setSubLabel(text = '') {
        this.texts.sub_label = text;
        this._sub_label.set_text(text);
        this._set_actors();
    }
    
    setStatus(text = '') {
        this.texts.status = text;
        this._status_text.set_text(text);
        this._set_actors();
    }
    
    set_tooltip(text = '') {
        this.texts.tooltip = text;
        this._tooltip.set_text(text);
        this._set_actors();
    }
    
    destroy() {
        super.destroy();
    }
    
}

/** @exports QGui.QPopupLocation */
class QPopupLocation extends QPopupItem {
    constructor({
        city = '',
        sunset_text = '',
        sunrise_text = '',
        sunset_tooltip = '',
        sunrise_tooltip = '',
        sunset_icon = '',
        sunrise_icon = '',
        icon_size = 16
    } = {}) {
        super({
            reactive: false, activate: false, sensitive: true,
            hover: true, focusOnHover: true,
            style_class: 'q-sun-bar', replace_class: false
        });
        
        this._city = new St.Label({text: city, style_class: 'q-sun-bar-city'});
        
        this._sunset = {
            holder: new QPopupItem({
                reactive: true, tooltip: sunset_tooltip,
                replace_class: true, style_class: 'q-sun-bar-item'
            }),
            icon: new QIcon({icon_name: sunset_icon, icon_size: icon_size}),
            label: new St.Label({text: sunset_text})
        };
        this._sunset.holder.addActor(this._sunset.icon.actor);
        this._sunset.holder.addActor(this._sunset.label, {span: 0, expand: false});
        
        
        this._sunrise = {
            holder: new QPopupItem({
                reactive: true, tooltip: sunrise_tooltip,
                replace_class: true, style_class: 'q-sun-bar-item'
            }),
            icon: new QIcon({icon_name: sunrise_icon, icon_size: icon_size}),
            label: new St.Label({text: sunrise_text})
        };
        this._sunrise.holder.addActor(this._sunrise.icon.actor);
        this._sunrise.holder.addActor(this._sunrise.label, {span: 0, expand: false});
        
        
        this.addActor(this._city, {span: 0, expand: true, align: St.Align.Start});
        
        let content_right = new QPopupItem({
            style_class: 'q-sun-bar-right',
            replace_class: true,
            reactive: false, activate: false, hover: false
        });
        content_right.addActor(this._sunset.holder.actor);
        content_right.addActor(this._sunrise.holder.actor);
        
        this.addActor(content_right.actor, {span: -1, expand: false, align: St.Align.END});
    }
    
    set_city_text(text) {
        this._city.set_text(text);
    }
    
    set_sunset_text(text) {
        this._sunset.label.set_text(text);
    }
    
    set_sunrise_text(text) {
        this._sunrise.label.set_text(text);
    }
    
}


/** @exports QGui.QPopupIconBar */
class QPopupIconBar extends QPopupItem {
    constructor({style_class = 'q-icon-bar', container_class = 'q-icon-bar-holder'} = {}) {
        
        super({reactive: false, activate: false, hover: false, style_class: style_class});
        
        
        this.contentLeft = new QPopupItem({
            style_class: container_class,
            replace_class: true,
            reactive: false, activate: false, hover: false
        });
        this.addActor(this.contentLeft.actor, {span: 0, expand: false});
        
        
        this.contentRight = new QPopupItem({
            style_class: container_class,
            replace_class: true,
            reactive: false, activate: false, hover: false
        });
        // this.addActor(this.contentRight.actor, {span: -1, expand: false, align: St.Align.END});
        
        this.addActor(this.contentRight.actor, {span: -1, expand: false, align: St.Align.END});
        
        
        // this.teste('system-run-system');
        // this.teste('quintao');
        // this.teste('quintao');
        
        // this.addIconLeft('quintao');
        
    }
    
    addOnLeft(item) {
        this.contentLeft.addActor(item.actor, {span: 0, expand: false});
    }
    
    addOnRight(item) {
        this.contentRight.addActor(item.actor, {span: 0, expand: false});
    }
}


/** @exports QGui.QPopupSlider */
class QPopupSlider extends QPopupItem {
    constructor({label = '', unit = '', value = 0, min = 0, max = 1, step = 0.1} = {}) {
        super({reactive: true});
        
        this._dragging = false;
        this._mark_position = 0;
        
        this.MIN = min;
        this.MAX = max;
        this.STEP = step;
        this.unit = unit;
        
        if (isNaN(value)) throw TypeError('The bar level value must be a number');
        this._value = Math.max(Math.min(value, this.MAX), this.MIN);
        
        this.label = new St.Label({text: label, styleClass: 'qpopup-slider-label'});
        if (label) this.addActor(this.label, {span: 0, expand: false});
        
        this.slider = new St.DrawingArea({
            styleClass: 'qpopup-slider',
            can_focus: true,
            hover: true,
            reactive: false,
            accessible_role: Atk.Role.MENU_ITEM
        });
        this.addActor(this.slider, {span: 1, expand: true});
        this.slider.connect('repaint', this._sliderRepaint.bind(this));
        // this.actor.connect('button-press-event', this._startDragging.bind(this));
        this.actor.connect('button-press-event', this._onButtonPress.bind(this));
        this.actor.connect('scroll-event', this._onScrollEvent.bind(this));
        this.actor.connect('key-press-event', this._onKeyPressEvent.bind(this));
        
        
        this.infoText = new St.Label({text: this._value + this.unit, styleClass: 'qpopup-slider-info'});
        this.addActor(this.infoText, {span: -1, expand: false, align: St.Align.END});
        
        
        
        
        
    }
    
    setValue(value) {
        if (isNaN(value)) throw TypeError('The slider value must be a number');
        this._value = Math.max(Math.min(value, this.MAX), this.MIN);
        this.infoText.set_text(this._value + this.unit);
        this.slider.queue_repaint();
    }
    
    setStep(value) {
        this.STEP = value;
    }
    
    _setValueEmit(value) {
        if (!Number.isInteger(this.STEP)) value = value.toFixed(2);
        
        this._value = Math.max(Math.min(value, this.MAX), this.MIN);
        
        this.infoText.set_text(this._value + this.unit);
        this.slider.queue_repaint();
        this.emit('value-changed', this._value);
    }
    
    _onButtonPress(actor, event) {
        let button = event.get_button();
        
        if (button == 1) {
            this._startDragging(actor, event);
        } else if (button == 3) {
            this.emit('right-click');
        }
    }
    
    _sliderRepaint(area) {
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        
        let handleRadius = themeNode.get_length('-slider-handle-radius');
        
        let sliderWidth = width - 2 * handleRadius;
        let sliderHeight = themeNode.get_length('-slider-height');
        
        let sliderBorderWidth = themeNode.get_length('-slider-border-width');
        let sliderBorderRadius = Math.min(width, sliderHeight) / 2;
        
        let sliderBorderColor = themeNode.get_color('-slider-border-color');
        // let sliderColor = themeNode.get_color('-slider-background-color');
        
        
        let sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
        // let sliderActiveColor = themeNode.get_color('-slider-active-background-color');
        
        let startColor = themeNode.get_color('-gradient-start');
        let endColor = themeNode.get_color('-gradient-end');
        
        let fgColor = themeNode.get_foreground_color();
        let sliderColor = fgColor.copy();
        let sliderActiveColor = fgColor.copy();
        sliderColor.alpha *= 0.2;
        sliderActiveColor.alpha *= 0.4;
        
        const TAU = Math.PI * 2;
        
        let handleX = handleRadius + (width - 2 * handleRadius) * this._value / this.MAX;
        
        
        let pat = new Cairo.LinearGradient(0.0, 0.0, width * 1.2, 0);
        pat.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, 1);
        pat.addColorStopRGBA(1, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        
        
        cr.arc(sliderBorderRadius + sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 1 / 4, TAU * 3 / 4);
        cr.lineTo(handleX, (height - sliderHeight) / 2);
        cr.lineTo(handleX, (height + sliderHeight) / 2);
        cr.lineTo(sliderBorderRadius + sliderBorderWidth, (height + sliderHeight) / 2);
        // cr.setSourceRGBA(1, 0.6, 0, 0.5);
        if (this.unit == 'K') cr.setSource(pat);
        else Clutter.cairo_set_source_color(cr, sliderActiveColor);
        
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, sliderActiveBorderColor);
        cr.setLineWidth(sliderBorderWidth);
        cr.stroke();
        
        cr.arc(width - sliderBorderRadius - sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 3 / 4, TAU * 1 / 4);
        cr.lineTo(handleX, (height + sliderHeight) / 2);
        cr.lineTo(handleX, (height - sliderHeight) / 2);
        cr.lineTo(width - sliderBorderRadius - sliderBorderWidth, (height - sliderHeight) / 2);
        if (this.unit == 'K') cr.setSource(pat);
        else Clutter.cairo_set_source_color(cr, sliderColor);
        
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, sliderBorderColor);
        cr.setLineWidth(sliderBorderWidth);
        cr.stroke();
        
        let handleY = height / 2;
        
        let color = themeNode.get_foreground_color();
        Clutter.cairo_set_source_color(cr, color);
        cr.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
        cr.fill();
        
        
        // Draw a mark to indicate a certain value
        if (this._mark_position > 0) {
            let markWidth = 2;
            let markHeight = sliderHeight + 4;
            let xMark = sliderWidth * this._mark_position + markWidth / 2;
            let yMark = height / 2 - markHeight / 2;
            cr.rectangle(xMark, yMark, markWidth, markHeight);
            cr.fill();
        }
        
        cr.$dispose();
    }
    
    _startDragging(actor, event) {
        if (this._dragging) // don't allow two drags at the same time
            return;
        
        this.emit('drag-begin');
        this._dragging = true;
        
        
        event.get_device().grab(this.slider);
        this._signals.connect(this.slider, 'button-release-event', this._endDragging.bind(this));
        this._signals.connect(this.slider, 'motion-event', this._motionEvent.bind(this));
        
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
    }
    
    _endDragging(actor, event) {
        if (this._dragging) {
            this._signals.disconnect('button-release-event', this.slider);
            this._signals.disconnect('motion-event', this.slider);
            
            event.get_device().ungrab(this.slider);
            this._dragging = false;
            
            this.emit('drag-end');
        }
        return true;
    }
    
    _motionEvent(actor, event) {
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
        return true;
    }
    
    _moveHandle(absX, absY) {
        let relX, relY, sliderX, sliderY;
        [sliderX, sliderY] = this.slider.get_transformed_position();
        relX = absX - sliderX;
        relY = absY - sliderY;
        
        let width = this.slider.width;
        let handleRadius = this.slider.get_theme_node().get_length('-slider-handle-radius');
        
        let newvalue;
        if (relX < handleRadius) newvalue = 0;
        else if (relX > width - handleRadius) newvalue = 1;
        else newvalue = (relX - handleRadius) / (width - 2 * handleRadius);
        
        
        newvalue *= this.MAX;
        if (Number.isInteger(this.STEP)) newvalue = Math.round(newvalue);
        
        this._setValueEmit(newvalue);
    }
    
    
    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();
        
        let newvalue = this._value;
        if (direction == Clutter.ScrollDirection.DOWN) {
            newvalue -= this.STEP;
        } else if (direction == Clutter.ScrollDirection.UP) {
            newvalue += this.STEP;
        }
        
        // qLOG('LOG', this._signals);
        
        this._setValueEmit(newvalue);
    }
    
    _onKeyPressEvent(actor, event) {
        let key = event.get_key_symbol();
        
        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) {
            let delta = key == Clutter.KEY_Right ? this.STEP : -this.STEP;
            this._setValueEmit(this._value + delta);
            this.emit('drag-end');
            return true;
        }
        return false;
    }
    
    
    get value() { return this._value; }
    
    set value(value) { this.setValue(value); }
    
}

/** @exports QGui.QPopupSwitch */
class QPopupSwitch extends QPopupItem {
    
    constructor({label = '', active = false, reactive = true} = {}) {
        super({reactive: reactive, activate: true});
        
        this.label = new St.Label({text: label});
        this.label.add_style_class_name('q-text-medium');
        this._statusLabel = new St.Label({text: '', style_class: 'popup-inactive-menu-item'});
        
        this._switch = new PopupMenu.Switch(active);
        
        this.addActor(this.label, {span: 0, expand: false});
        this.addActor(this._statusLabel, {span: 0, expand: false});
        
        this._statusBin = new St.Bin();
        this.addActor(this._statusBin, {span: -1, expand: false, align: St.Align.END});
        this._statusBin.child = this._switch.actor;
        
        
        // this._statusLabel.set_style('background: blue;');
        // this.actor.set_style('cursor: pointer;');
    }
    
    setStatus(text) {
        if (text != null) {
            this._statusLabel.set_text(text);
        } else {
            this._statusLabel.set_text('');
        }
    }
    
    activate(event) {
        if (this._switch.actor.mapped) {
            this.toggle();
        }
        
        this.emit('activate', event, true);
    }
    
    toggle() {
        this._switch.toggle();
        this.emit('toggled', this._switch.state);
    }
    
    get state() {
        return this._switch.state;
    }
    
    setToggleState(state) {
        this._switch.setToggleState(state);
    }
}
