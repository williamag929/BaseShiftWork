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
        Task<ShiftEvent> GetShiftEventByIdAsync(Guid id);
        Task<IEnumerable<ShiftEvent>> GetShiftEventsByPersonIdAsync(string companyId, int personId);
        Task<IEnumerable<ShiftEvent>> GetShiftEventsByCompanyIdAsync(string companyId);
        Task<IEnumerable<ShiftEvent>> GetShiftEventsByEventTypeAsync(string companyId, string eventType);
        Task<ShiftEvent?> UpdateShiftEventAsync(Guid id, ShiftEventDto shiftEventDto);
        Task<bool> DeleteShiftEventAsync(Guid id);
    }
}
