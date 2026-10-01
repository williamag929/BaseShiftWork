using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using ShiftWork.Api.Models;
using ShiftWork.Api.DTOs;

namespace ShiftWork.Api.Services
{
    public interface IShiftEventService
    {
        Task<ShiftEvent> CreateShiftEventAsync(ShiftEventDto shiftEventDto);

        /// <summary>
        /// Throws <see cref="NfcRequiredException"/> when a clock-in/out would land on a site with
        /// RequireNfc (the DTO's LocationId, else the person's schedule for that day). Callers decide
        /// who the rule applies to; the controller applies it to the employee's own phone punches only.
        /// </summary>
        Task EnsureNfcNotRequiredAsync(ShiftEventDto shiftEventDto);

    Task<ShiftEvent?> GetShiftEventByIdAsync(Guid id);
        Task<IEnumerable<ShiftEvent>> GetShiftEventsByPersonIdAsync(string companyId, int personId);
        Task<IEnumerable<ShiftEvent>> GetShiftEventsByCompanyIdAsync(string companyId);
        Task<IEnumerable<ShiftEvent>> GetShiftEventsByEventTypeAsync(string companyId, string eventType);
        Task<ShiftEvent?> UpdateShiftEventAsync(Guid id, ShiftEventDto shiftEventDto);
        Task<bool> DeleteShiftEventAsync(Guid id);
        Task<bool> EnsureAutoClockOutForPersonAsync(string companyId, int personId, DateTime? nowUtc = null);

        /// <summary>
        /// Resolves the target job site (explicit id, else the person's schedule for today), computes
        /// lateness/geofence status against it, persists both on <paramref name="shiftEvent"/>, and
        /// updates <c>Person.StatusShiftWork</c>. Shared by <see cref="CreateShiftEventAsync"/> (mobile /
        /// direct API callers) and <c>KioskService.ClockFromKioskAsync</c> (kiosk callers, which always
        /// have an explicit <paramref name="explicitLocationId"/> from the device's enrollment).
        /// </summary>
        Task ApplyStatusAndGeofenceAsync(ShiftEvent shiftEvent, int? explicitLocationId);

        /// <summary>Marks a geofence-flagged clock event as reviewed by a manager.</summary>
        Task<ShiftEvent?> ReviewGeofenceFlagAsync(string companyId, Guid eventLogId, int? reviewerPersonId);
    }
}
