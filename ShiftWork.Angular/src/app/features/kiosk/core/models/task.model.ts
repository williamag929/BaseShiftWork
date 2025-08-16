export interface Task {
    TaskShiftId: string;
    TaskShiftName: string;
    Comment: string;
    lastAction: 'in-progress' | 'done';
    userId: string;
  }
