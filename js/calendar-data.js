(function () {
  "use strict";

  const CALENDAR_CONFIG = Object.freeze({
    minimumDelayDays: 7,
    workingDays: [1, 2, 3, 4, 5],
    slots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
    fullyBookedOffsets: [9, 13, 20, 27],
    partiallyBookedByWeekday: {
      1: ["09:00"],
      3: ["11:00", "15:00"],
      5: ["16:00"]
    }
  });

  function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function addDays(date, days) {
    const result = startOfDay(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function toDateKey(date) {
    const value = startOfDay(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getMinimumBookingDate() {
    return addDays(new Date(), CALENDAR_CONFIG.minimumDelayDays);
  }

  function getFullyBookedDates() {
    return CALENDAR_CONFIG.fullyBookedOffsets.map((offset) => toDateKey(addDays(new Date(), offset)));
  }

  function isBookableDay(date) {
    const value = startOfDay(date);
    return value >= getMinimumBookingDate() && CALENDAR_CONFIG.workingDays.includes(value.getDay());
  }

  function getAvailableSlots(date) {
    const value = startOfDay(date);
    if (!isBookableDay(value) || getFullyBookedDates().includes(toDateKey(value))) return [];
    const unavailable = CALENDAR_CONFIG.partiallyBookedByWeekday[value.getDay()] || [];
    return CALENDAR_CONFIG.slots.filter((slot) => !unavailable.includes(slot));
  }

  window.FinasureCalendarData = Object.freeze({
    config: CALENDAR_CONFIG,
    toDateKey,
    getMinimumBookingDate,
    getFullyBookedDates,
    isBookableDay,
    getAvailableSlots
  });
  window.getAvailableSlots = getAvailableSlots;
})();
