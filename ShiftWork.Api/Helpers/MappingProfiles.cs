using AutoMapper;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;

namespace ShiftWork.Api.Helpers
{
    public class MappingProfiles : Profile
    {
        public MappingProfiles()
        {
            CreateMap<Area, AreaDto>();
            CreateMap<AreaDto, Area>();
            CreateMap<Company, CompanyDto>();
            CreateMap<CompanyDto, Company>();
            CreateMap<Location, LocationDto>();
            CreateMap<LocationDto, Location>();
            CreateMap<Person, PersonDto>();
            CreateMap<PersonDto, Person>();
            CreateMap<Role, RoleDto>();
            CreateMap<RoleDto, Role>();
            CreateMap<Schedule, ScheduleDto>();
            CreateMap<ScheduleDto, Schedule>();
            CreateMap<ScheduleShift, ScheduleShiftDto>();
            CreateMap<ScheduleShiftDto, ScheduleShift>();
            CreateMap<TaskShift, TaskShiftDto>();
            CreateMap<TaskShiftDto, TaskShift>();
            CreateMap<Crew, CrewDto>();
            CreateMap<CrewDto, Crew>();
        }
    }
}