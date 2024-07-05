/**
 * @see https://github.com/mourner/suncalc
 */

/** @exports QSunCalc.QSunCalc */
class SunCalc {
  constructor() {
    this.PI = Math.PI;
    this.sin = Math.sin;
    this.cos = Math.cos;
    this.tan = Math.tan;
    this.asin = Math.asin;
    this.atan = Math.atan2;
    this.acos = Math.acos;
    this.rad = this.PI / 180;
    this.dayMs = 1000 * 60 * 60 * 24;
    this.J1970 = 2440588;
    this.J2000 = 2451545;
    this.e = this.rad * 23.4397; // obliquity of the Earth
    this.J0 = 0.0009;

    this.times = [
      [-0.833, 'sunrise', 'sunset'],
      [-0.3, 'sunriseEnd', 'sunsetStart'],
      [-6, 'dawn', 'dusk'],
      [-12, 'nauticalDawn', 'nauticalDusk'],
      [-18, 'nightEnd', 'night'],
      [6, 'goldenHourEnd', 'goldenHour']
    ];
  }

  toJulian(date) {
    return date.valueOf() / this.dayMs - 0.5 + this.J1970;
  }

  fromJulian(j) {
    return new Date((j + 0.5 - this.J1970) * this.dayMs);
  }

  toDays(date) {
    return this.toJulian(date) - this.J2000;
  }

  rightAscension(l, b) {
    return this.atan(this.sin(l) * this.cos(this.e) - this.tan(b) * this.sin(this.e), this.cos(l));
  }

  declination(l, b) {
    return this.asin(this.sin(b) * this.cos(this.e) + this.cos(b) * this.sin(this.e) * this.sin(l));
  }

  azimuth(H, phi, dec) {
    return this.atan(this.sin(H), this.cos(H) * this.sin(phi) - this.tan(dec) * this.cos(phi));
  }

  altitude(H, phi, dec) {
    return this.asin(this.sin(phi) * this.sin(dec) + this.cos(phi) * this.cos(dec) * this.cos(H));
  }

  siderealTime(d, lw) {
    return this.rad * (280.16 + 360.9856235 * d) - lw;
  }

  astroRefraction(h) {
    if (h < 0) h = 0;
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
  }

  solarMeanAnomaly(d) {
    return this.rad * (357.5291 + 0.98560028 * d);
  }

  eclipticLongitude(M) {
    const C = this.rad * (1.9148 * this.sin(M) + 0.02 * this.sin(2 * M) + 0.0003 * this.sin(3 * M));
    const P = this.rad * 102.9372;
    return M + C + P + this.PI;
  }

  sunCoords(d) {
    const M = this.solarMeanAnomaly(d);
    const L = this.eclipticLongitude(M);
    return {
      dec: this.declination(L, 0),
      ra:  this.rightAscension(L, 0)
    };
  }

  getPosition(date, lat, lng) {
    const lw = this.rad * -lng;
    const phi = this.rad * lat;
    const d = this.toDays(date);
    const c = this.sunCoords(d);
    const H = this.siderealTime(d, lw) - c.ra;
    return {
      azimuth:  this.azimuth(H, phi, c.dec),
      altitude: this.altitude(H, phi, c.dec)
    };
  }

  addTime(angle, riseName, setName) {
    this.times.push([angle, riseName, setName]);
  }

  julianCycle(d, lw) {
    return Math.round(d - this.J0 - lw / (2 * this.PI));
  }

  approxTransit(Ht, lw, n) {
    return this.J0 + (Ht + lw) / (2 * this.PI) + n;
  }

  solarTransitJ(ds, M, L) {
    return this.J2000 + ds + 0.0053 * this.sin(M) - 0.0069 * this.sin(2 * L);
  }

  hourAngle(h, phi, d) {
    return this.acos((this.sin(h) - this.sin(phi) * this.sin(d)) / (this.cos(phi) * this.cos(d)));
  }

  observerAngle(height) {
    return -2.076 * Math.sqrt(height) / 60;
  }

  getSetJ(h, lw, phi, dec, n, M, L) {
    const w = this.hourAngle(h, phi, dec);
    const a = this.approxTransit(w, lw, n);
    return this.solarTransitJ(a, M, L);
  }

  /**
   * calculates sun times for a given date
   * @param {Date} date
   * @param {number} lat latitude
   * @param {number} lng longitude
   * @param {number} height height (in meters) relative to the horizon
   * @return {{solarNoon:Date, nadir:Date, sunrise:Date, sunset:Date, sunriseEnd:Date, sunsetStart:Date, dawn:Date, dusk:Date, nauticalDawn:Date, nauticalDusk:Date, nightEnd:Date, night:Date, goldenHourEnd:Date, goldenHour:Date}}
   */
  getTimes(date, lat, lng, height = 0) {
    const lw = this.rad * -lng;
    const phi = this.rad * lat;
    const dh = this.observerAngle(height);
    const d = this.toDays(date);
    const n = this.julianCycle(d, lw);
    const ds = this.approxTransit(0, lw, n);
    const M = this.solarMeanAnomaly(ds);
    const L = this.eclipticLongitude(M);
    const dec = this.declination(L, 0);
    const Jnoon = this.solarTransitJ(ds, M, L);

    const result = {
      solarNoon: this.fromJulian(Jnoon),
      nadir:     this.fromJulian(Jnoon - 0.5)
    };

    for (let i = 0, len = this.times.length; i < len; i += 1) {
      const time = this.times[i];
      const h0 = (time[0] + dh) * this.rad;

      const Jset = this.getSetJ(h0, lw, phi, dec, n, M, L);
      const Jrise = Jnoon - (Jset - Jnoon);

      result[time[1]] = this.fromJulian(Jrise);
      result[time[2]] = this.fromJulian(Jset);
    }

    return result;
  }

  moonCoords(d) {
    const L = this.rad * (218.316 + 13.176396 * d);
    const M = this.rad * (134.963 + 13.064993 * d);
    const F = this.rad * (93.272 + 13.229350 * d);
    const l = L + this.rad * 6.289 * this.sin(M);
    const b = this.rad * 5.128 * this.sin(F);
    const dt = 385001 - 20905 * this.cos(M);

    return {
      ra:   this.rightAscension(l, b),
      dec:  this.declination(l, b),
      dist: dt
    };
  }

  getMoonPosition(date, lat, lng) {
    const lw = this.rad * -lng;
    const phi = this.rad * lat;
    const d = this.toDays(date);
    const c = this.moonCoords(d);
    const H = this.siderealTime(d, lw) - c.ra;
    let h = this.altitude(H, phi, c.dec);
    h = h + this.astroRefraction(h);
    const pa = this.atan(this.sin(H), this.tan(phi) * this.cos(c.dec) - this.sin(c.dec) * this.cos(H));

    return {
      azimuth:          this.azimuth(H, phi, c.dec),
      altitude:         h,
      distance:         c.dist,
      parallacticAngle: pa
    };
  }

  getMoonIllumination(date) {
    const d = this.toDays(date || new Date());
    const s = this.sunCoords(d);
    const m = this.moonCoords(d);
    const sdist = 149598000;

    const phi = this.acos(this.sin(s.dec) * this.sin(m.dec) + this.cos(s.dec) * this.cos(m.dec) * this.cos(s.ra - m.ra));
    const inc = this.atan(sdist * this.sin(phi), m.dist - sdist * this.cos(phi));
    const angle = this.atan(this.cos(s.dec) * this.sin(s.ra - m.ra), this.sin(s.dec) * this.cos(m.dec) - this.cos(s.dec) * this.sin(m.dec) * this.cos(s.ra - m.ra));

    return {
      fraction: (1 + this.cos(inc)) / 2,
      phase:    0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / this.PI,
      angle:    angle
    };
  }

  hoursLater(date, h) {
    return new Date(date.valueOf() + h * this.dayMs / 24);
  }
}