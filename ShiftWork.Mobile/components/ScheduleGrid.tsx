import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScheduleGridData, ScheduleFilters, TeamMember, ShiftBlock } from '@/types/schedule-grid';
import { formatDate } from '@/utils/date.utils';

interface ScheduleGridProps {
  data: ScheduleGridData;
  filters: ScheduleFilters;
  onFiltersChange: (filters: ScheduleFilters) => void;
  onShiftPress?: (shift: ShiftBlock) => void;
  onAddShift?: (personId: number, date: Date) => void;
}

export default function ScheduleGrid({
  data,
  filters,
  onFiltersChange,
  onShiftPress,
  onAddShift,
}: ScheduleGridProps) {
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const getShiftColor = (status: string) => {
    switch (status) {
      case 'published':
        return '#C8E6C9'; // light green
      case 'locked':
        return '#C8E6C9'; // light green with lock badge
      case 'unpublished':
        return '#FFF9C4'; // light yellow
      case 'open':
        return '#E1BEE7'; // light purple
      default:
        return '#E0E0E0';
    }
  };

  const renderTeamMember = (member: TeamMember) => (
    <View key={member.personId} style={styles.teamMemberRow}>
      <View style={styles.memberInfo}>
        <View style={styles.avatar}>
          {member.profilePhotoUrl ? (
            <Text style={styles.avatarText}>{member.initials}</Text>
          ) : (
            <Text style={styles.avatarText}>{member.initials}</Text>
          )}
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{member.fullName}</Text>
          <Text style={styles.memberHours}>{member.totalHours}</Text>
        </View>
      </View>
    </View>
  );

  const renderShiftBlock = (shift: ShiftBlock, date: Date) => (
    <TouchableOpacity
      key={shift.scheduleShiftId}
      style={[styles.shiftBlock, { backgroundColor: getShiftColor(shift.status) }]}
      onPress={() => onShiftPress?.(shift)}
    >
      <Text style={styles.shiftTime}>
        {shift.startTime} – {shift.endTime}
      </Text>
      <Text style={styles.shiftPerson}>{shift.personName}</Text>
      {shift.isLocked && (
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={10} color="#fff" />
          <Text style={styles.lockText}>LOCKED</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDayColumn = (day: typeof data.days[0], personId: number) => {
    const shiftsForPerson = day.shifts.filter((s) => s.personId === personId);
    return (
      <View key={day.date.toISOString()} style={styles.dayCell}>
        {shiftsForPerson.length === 0 ? (
          <TouchableOpacity
            style={styles.emptyCell}
            onPress={() => onAddShift?.(personId, day.date)}
          >
            <Ionicons name="add" size={20} color="#999" />
          </TouchableOpacity>
        ) : (
          shiftsForPerson.map((shift) => renderShiftBlock(shift, day.date))
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with location and controls */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.locationBtn}>
          <Ionicons name="location" size={16} color="#4A90E2" />
          <Text style={styles.locationText}>{data.locationName}</Text>
          <Ionicons name="chevron-down" size={16} color="#4A90E2" />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {formatDate(data.weekStart)} – {formatDate(data.weekEnd)}
          </Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="chevron-forward" size={20} color="#333" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="refresh" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="share-outline" size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={20} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search and filter bar */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={filters.searchQuery}
            onChangeText={(text) => onFiltersChange({ ...filters, searchQuery: text })}
          />
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterModalOpen(true)}
        >
          <Ionicons name="options" size={18} color="#4A90E2" />
          <Text style={styles.filterBtnText}>
            {(filters.shiftTypes?.length || 0) + (filters.trainingTypes?.length || 0) || ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#E0E0E0' }]} />
          <Text style={styles.statText}>{data.stats.empty} empty</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#FFF9C4' }]} />
          <Text style={styles.statText}>{data.stats.unpublished} unpublished</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#C8E6C9' }]} />
          <Text style={styles.statText}>{data.stats.published} published</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#81C784' }]} />
          <Text style={styles.statText}>{data.stats.requireConfirmation} require confirmation</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#BA68C8' }]} />
          <Text style={styles.statText}>{data.stats.openShifts} open shifts</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#E57373' }]} />
          <Text style={styles.statText}>{data.stats.warnings} warnings</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#FFB74D' }]} />
          <Text style={styles.statText}>{data.stats.leavePending} leave pending</Text>
        </View>
        <View style={styles.stat}>
          <View style={[styles.statDot, { backgroundColor: '#D1C4E9' }]} />
          <Text style={styles.statText}>{data.stats.unavailable} unavailable</Text>
        </View>
      </View>

      {/* Grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={true}>
        <View>
          {/* Day headers */}
          <View style={styles.headerRow}>
            <View style={styles.teamColumn}>
              <View style={styles.openShiftsHeader}>
                <Ionicons name="person" size={16} color="#333" />
                <Text style={styles.openShiftsText}>Open shifts</Text>
                <Text style={styles.openShiftsCount}>0h</Text>
              </View>
            </View>
            {data.days.map((day) => (
              <View key={day.date.toISOString()} style={styles.dayHeader}>
                <Text style={styles.dayName}>{day.dayName}</Text>
                {day.unavailableCount > 0 && (
                  <View style={styles.unavailableBadge}>
                    <Text style={styles.unavailableText}>
                      {day.unavailableCount} Unavailable
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Scrollable content */}
          <ScrollView style={styles.gridScroll}>
            {data.teamMembers.map((member) => (
              <View key={member.personId} style={styles.gridRow}>
                <View style={styles.teamColumn}>{renderTeamMember(member)}</View>
                {data.days.map((day) => renderDayColumn(day, member.personId))}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter and sort</Text>
              <TouchableOpacity onPress={() => setFilterModalOpen(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Quickly narrow down your team list with the new filtering options
            </Text>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Sort by</Text>
              <TouchableOpacity style={styles.filterDropdown}>
                <Text style={styles.filterValue}>Name</Text>
                <Ionicons name="chevron-down" size={16} color="#999" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Shift type</Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Empty</Text>
                  <TouchableOpacity>
                    <Ionicons name="close-circle" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Open</Text>
                  <TouchableOpacity>
                    <Ionicons name="close-circle" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Training</Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Cash handling</Text>
                  <TouchableOpacity>
                    <Ionicons name="close-circle" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>Forklift</Text>
                  <TouchableOpacity>
                    <Ionicons name="close-circle" size={16} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setFilterModalOpen(false)}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  locationText: { fontSize: 14, color: '#4A90E2', fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekLabel: { fontSize: 14, fontWeight: '600', color: '#333' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 6 },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: '#333' },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
    backgroundColor: '#fff',
  },
  filterBtnText: { fontSize: 12, color: '#4A90E2', fontWeight: '600' },
  statsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 12,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot: { width: 12, height: 12, borderRadius: 6 },
  statText: { fontSize: 12, color: '#666' },
  headerRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  teamColumn: { width: 200, borderRightWidth: 1, borderRightColor: '#E0E0E0' },
  openShiftsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 6,
  },
  openShiftsText: { fontSize: 14, fontWeight: '600', color: '#333' },
  openShiftsCount: { fontSize: 12, color: '#999' },
  dayHeader: {
    width: 150,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
  },
  dayName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  unavailableBadge: {
    backgroundColor: '#D1C4E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unavailableText: { fontSize: 12, color: '#5E35B1' },
  gridScroll: { flex: 1 },
  gridRow: {
    flexDirection: 'row',
    minHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  teamMemberRow: {
    padding: 12,
    height: '100%',
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  memberDetails: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#333' },
  memberHours: { fontSize: 12, color: '#999', marginTop: 2 },
  dayCell: {
    width: 150,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#E0E0E0',
    gap: 8,
  },
  emptyCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  shiftBlock: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  shiftTime: { fontSize: 12, fontWeight: '600', color: '#333' },
  shiftPerson: { fontSize: 12, color: '#666', marginTop: 2 },
  lockBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#757575',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    gap: 2,
  },
  lockText: { fontSize: 8, color: '#fff', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#fff',
    width: '85%',
    maxWidth: 500,
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  filterSection: { marginBottom: 16 },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  filterDropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  filterValue: { fontSize: 14, color: '#333' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipText: { fontSize: 14, color: '#333' },
  doneBtn: {
    backgroundColor: '#6C5CE7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
