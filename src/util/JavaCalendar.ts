function calendarGmtFields(days: number): [number, number, number] {
    const jdn = 2440588 + days;
    let base: number, centuries: number;
    if (jdn >= 2299161) {
        const a = jdn + 32044;
        centuries = Math.floor((4 * a + 3) / 146097);
        base = a - Math.floor((146097 * centuries) / 4);
    } else {
        centuries = 0;
        base = jdn + 32082;
    }
    const years = Math.floor((4 * base + 3) / 1461);
    const remainder = base - Math.floor((1461 * years) / 4);
    const m = Math.floor((5 * remainder + 2) / 153);
    const day = remainder - Math.floor((153 * m + 2) / 5) + 1;
    const month = m + 3 - 12 * Math.floor(m / 10);
    const year = 100 * centuries + years - 4800 + Math.floor(m / 10);
    return [day, month - 1, year <= 0 ? 1 - year : year];
}

const dayMillis = 86400000n;

// java.util.GregorianCalendar, using the zone captured by Calendar.getInstance().
export default class JavaCalendar {
    private readonly offsets: Intl.DateTimeFormat;
    private readonly rawOffset: number;
    time: bigint;

    constructor(zone = Intl.DateTimeFormat().resolvedOptions().timeZone, time = BigInt(Date.now())) {
        this.offsets = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' });
        const year = new Date().getUTCFullYear();
        this.rawOffset = Math.min(this.zoneOffset(Date.UTC(year, 0, 1)), this.zoneOffset(Date.UTC(year, 6, 1)));
        this.time = time;
    }

    private zoneOffset(millis: number): number {
        const name = this.offsets.formatToParts(millis).find(part => part.type === 'timeZoneName')?.value;
        if (name === 'GMT') return 0;
        const parts = /^GMT([+-])(\d+):(\d+)(?::(\d+))?$/.exec(name ?? '');
        if (parts === null) throw new Error('Unknown UTC offset ' + name);
        return (parts[1] === '-' ? -1 : 1) * (Number(parts[2]) * 3600 + Number(parts[3]) * 60 + Number(parts[4] ?? 0)) * 1000;
    }

    private offset(millis: bigint): number {
        // The JVM ZoneInfo table starts in 1900 and falls back to rawOffset for older dates.
        if (millis < -2208988800000n) return this.rawOffset;
        if (millis > 8640000000000000n) {
            const cycle = 146097n * dayMillis;
            millis = ((millis - 10957n * dayMillis) % cycle) + 10957n * dayMillis;
        }
        return this.zoneOffset(Number(millis));
    }

    // Calendar.getTime() returns a Date for getTimeInMillis().
    getTimeInMillis(): bigint {
        return this.time;
    }

    // java.util.Calendar.setTime(Date) delegates to setTimeInMillis(date.getTime()).
    setTimeInMillis(time: bigint): void {
        this.time = BigInt.asIntN(64, time);
    }

    // java.util.Calendar.get(I)I fields used by the gamepack.
    get(field: 1 | 2 | 5 | 7 | 11 | 12 | 13): number {
        const local = this.time + BigInt(this.offset(this.time));
        const millis = Number(((local % dayMillis) + dayMillis) % dayMillis);
        const days = Number((local - BigInt(millis)) / dayMillis);
        switch (field) {
            case 1:
                return calendarGmtFields(days)[2];
            case 2:
                return calendarGmtFields(days)[1];
            case 5:
                return calendarGmtFields(days)[0];
            case 7:
                return ((((days + 4) % 7) + 7) % 7) + 1;
            case 11:
                return (millis / 3600000) | 0;
            case 12:
                return ((millis / 60000) | 0) % 60;
            case 13:
                return ((millis / 1000) | 0) % 60;
        }
    }

    // With all fields cleared, getTime() defaults to 1970-01-01 midnight in this calendar's zone.
    clear(): void {
        this.time = -BigInt(this.offset(-BigInt(this.rawOffset)));
    }

    // Calendar.set(Calendar.HOUR_OF_DAY, hour) preserves the other local fields.
    setHourOfDay(hour: number): void {
        const hourMillis = 3600000n;
        const local = this.time + BigInt(this.offset(this.time));
        const oldHour = (((local % dayMillis) + dayMillis) % dayMillis) / hourMillis;
        const wall = BigInt.asIntN(64, local + (BigInt(hour) - oldHour) * hourMillis);
        const estimate = BigInt.asIntN(64, wall - BigInt(this.rawOffset));
        this.time = BigInt.asIntN(64, wall - BigInt(this.offset(estimate)));
    }

    // Calendar.set(year, month, day) preserves hour, minute, second and millisecond.
    setDate(year: number, month: number, day: number): void {
        const local = this.time + BigInt(this.offset(this.time));
        const timeOfDay = ((local % dayMillis) + dayMillis) % dayMillis;
        const shift = Math.floor(month / 12);
        const y = ((year + shift) | 0) + 4800;
        const m = month - shift * 12;
        const yearFromMarch = y - (m < 2 ? 1 : 0),
            monthFromMarch = m + (m < 2 ? 10 : -2);
        const first = 365 * yearFromMarch + Math.floor(yearFromMarch / 4) + Math.floor((153 * monthFromMarch + 2) / 5) + day;
        const gregorian = first - Math.floor(yearFromMarch / 100) + Math.floor(yearFromMarch / 400) - 32045;
        const julian = first - 32083;
        const jdn = year >= 1582 && gregorian >= 2299161 ? gregorian : julian;
        const wall = BigInt.asIntN(64, BigInt(jdn - 2440588) * dayMillis + timeOfDay);
        const estimate = BigInt.asIntN(64, wall - BigInt(this.rawOffset));
        this.time = BigInt.asIntN(64, wall - BigInt(this.offset(estimate)));
    }
}
