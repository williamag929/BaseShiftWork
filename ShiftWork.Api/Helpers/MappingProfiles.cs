using AutoMapper;
using ShiftWork.Api.DTOs;
using ShiftWork.Api.Models;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

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
            CreateMap<CompanyUser, CompanyUserDto>();
            CreateMap<CompanyUserDto, CompanyUser>();
            CreateMap<Location, LocationDto>()
                .ForMember(dest => dest.GeoCoordinates, opt => opt.MapFrom(src =>
                    !string.IsNullOrEmpty(src.GeoCoordinates)
                        ? JsonSerializer.Deserialize<GeoCoordinatesDto>(src.GeoCoordinates, (JsonSerializerOptions)null)
                        : null));
             CreateMap<LocationDto, Location>()
                .ForMember(dest => dest.GeoCoordinates, opt => opt.MapFrom(src =>
                    src.GeoCoordinates != null ? JsonSerializer.Serialize(src.GeoCoordinates, (JsonSerializerOptions)null) : null));
            CreateMap<Person, PersonDto>();
             CreateMap<PersonDto, Person>();
            CreateMap<Role, RoleDto>()
                .ForMember(dest => dest.Permissions, opt => opt.MapFrom(src =>
                    !string.IsNullOrEmpty(src.Permissions) && src.Permissions.TrimStart().StartsWith("[")
                        ? JsonSerializer.Deserialize<List<string>>(src.Permissions, (JsonSerializerOptions)null)
                        : new List<string>()));
             CreateMap<RoleDto, Role>()
                .ForMember(dest => dest.Permissions, opt => opt.MapFrom(src =>
                    src.Permissions != null && src.Permissions.Any() 
                        ? JsonSerializer.Serialize(src.Permissions, (JsonSerializerOptions)null) : null));
            CreateMap<Schedule, ScheduleDto>()
                .ForMember(dest => dest.PersonId, opt => opt.MapFrom(src =>
                    src.PersonId == null ? 0 : int.Parse(src.PersonId)));
            CreateMap<ScheduleDto, Schedule>()
                .ForMember(dest => dest.PersonId, opt => opt.MapFrom(src => src.PersonId.ToString()));
            CreateMap<ScheduleShift, ScheduleShiftDto>();
             CreateMap<ScheduleShiftDto, ScheduleShift>();
            CreateMap<TaskShift, TaskShiftDto>();
            CreateMap<TaskShiftDto, TaskShift>();
            CreateMap<Crew, CrewDto>();
            CreateMap<CrewDto, Crew>();
            CreateMap<ShiftEvent, ShiftEventDto>();
            CreateMap<ShiftEventDto, ShiftEvent>();
            CreateMap<Schedule, ScheduleDetailDto>();
        }
    }
}