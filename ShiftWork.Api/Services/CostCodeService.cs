using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShiftWork.Api.Data;
using ShiftWork.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ShiftWork.Api.Services
{
    /// <summary>
    /// Defines the contract for the cost code service.
    /// </summary>
    public interface ICostCodeService
    {
        Task<IEnumerable<CostCode>> Get(string companyId, int[] costCodeIds);
        Task<CostCode> Add(CostCode costCode);
        Task<CostCode> Update(CostCode costCode);
        Task<bool> Delete(CostCode costCode);
    }

    /// <summary>
    /// Service for managing cost codes.
    /// </summary>
    public class CostCodeService : ICostCodeService
    {
        private readonly ShiftWorkContext _context;
        private readonly ILogger<CostCodeService> _logger;

        public CostCodeService(ShiftWorkContext context, ILogger<CostCodeService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Adds a new cost code to the database.
        /// </summary>
        public async Task<CostCode> Add(CostCode costCode)
        {
            if (costCode == null) throw new ArgumentNullException(nameof(costCode));

            try
            {
                var duplicate = await _context.CostCodes
                    .AnyAsync(c => c.CompanyId == costCode.CompanyId && c.Code == costCode.Code);
                if (duplicate)
                {
                    throw new InvalidOperationException($"A cost code with code '{costCode.Code}' already exists for this company.");
                }

                _context.CostCodes.Add(costCode);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Successfully added new cost code with ID {CostCodeId}", costCode.CostCodeId);
                return costCode;
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error adding a new cost code to the database.");
                throw;
            }
        }

        /// <summary>
        /// Deletes a cost code from the database.
        /// </summary>
        public async Task<bool> Delete(CostCode costCode)
        {
            if (costCode == null) throw new ArgumentNullException(nameof(costCode));

            try
            {
                _context.CostCodes.Remove(costCode);
                var changes = await _context.SaveChangesAsync();
                var success = changes > 0;
                if (success)
                {
                    _logger.LogInformation("Successfully deleted cost code with ID {CostCodeId}", costCode.CostCodeId);
                }
                else
                {
                    _logger.LogWarning("Failed to delete cost code with ID {CostCodeId}. It may have already been deleted.", costCode.CostCodeId);
                }
                return success;
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error deleting cost code with ID {CostCodeId} from the database.", costCode.CostCodeId);
                throw;
            }
        }

        /// <summary>
        /// Retrieves cost codes based on company and cost code IDs.
        /// </summary>
        /// <param name="companyId">The company's ID.</param>
        /// <param name="costCodeIds">An array of cost code IDs to retrieve. If empty, retrieves all.</param>
        public async Task<IEnumerable<CostCode>> Get(string companyId, int[] costCodeIds)
        {
            if (string.IsNullOrEmpty(companyId)) throw new ArgumentException("Company ID cannot be null or empty.", nameof(companyId));

            try
            {
                var query = _context.CostCodes.AsQueryable();
                query = query.Where(c => c.CompanyId == companyId);

                if (costCodeIds != null && costCodeIds.Length > 0)
                {
                    query = query.Where(c => costCodeIds.Contains(c.CostCodeId));
                }

                var result = await query.OrderBy(c => c.Code).ToListAsync();
                return result ?? new List<CostCode>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving cost codes for company {CompanyId}.", companyId);
                throw;
            }
        }

        /// <summary>
        /// Updates an existing cost code.
        /// </summary>
        public async Task<CostCode> Update(CostCode costCode)
        {
            if (costCode == null) throw new ArgumentNullException(nameof(costCode));

            try
            {
                var existing = await _context.CostCodes
                    .FirstOrDefaultAsync(c => c.CostCodeId == costCode.CostCodeId && c.CompanyId == costCode.CompanyId);

                if (existing == null)
                {
                    throw new InvalidOperationException($"Cost code with ID {costCode.CostCodeId} not found.");
                }

                existing.Code = costCode.Code;
                existing.Name = costCode.Name;
                existing.Description = costCode.Description;
                existing.LocationId = costCode.LocationId;
                existing.ExternalCode = costCode.ExternalCode;
                existing.Status = costCode.Status;

                await _context.SaveChangesAsync();
                _logger.LogInformation("Successfully updated cost code with ID {CostCodeId}", costCode.CostCodeId);
                return existing;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error while updating cost code {CostCodeId}.", costCode.CostCodeId);
                throw;
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Error updating cost code with ID {CostCodeId} in the database.", costCode.CostCodeId);
                throw;
            }
        }
    }
}
