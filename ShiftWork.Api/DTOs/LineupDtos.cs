using System;
using System.Collections.Generic;

namespace ShiftWork.Api.DTOs
{
    public record DefaultShiftDto(string Start, string End, int? AreaId);
    public record LineupShiftDto(int ShiftId, int PersonId, string Name, DateTime Start, DateTime End, string Status);
    public record LineupLocationDto(int LocationId, string Name, DefaultShiftDto? DefaultShift, List<LineupShiftDto> Shifts);
    public record LineupPersonDto(int PersonId, string Name, List<int> CrewIds);
    public record LineupUnavailableDto(int PersonId, string Name, string Reason);
    public record LineupCrewDto(int CrewId, string Name, List<int> MemberIds);
    public record LineupDto(
        string Date,
        string TimeZone,
        bool CanEdit,
        List<LineupLocationDto> Locations,
        List<LineupPersonDto> Bench,
        List<LineupUnavailableDto> Unavailable,
        List<LineupCrewDto> Crews);
}
