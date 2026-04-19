const mockFrom = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { fetchAppointments, fetchBookedSlots } from '../Screens/services/appointmentService';
import { createQueryBuilder } from './testUtils';

describe('appointmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters appointments by user_id for user role', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await fetchAppointments('user-123', 'user');

    expect(mockFrom).toHaveBeenCalledWith('appointments');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });

  it('does not apply user_id filter for admin role', async () => {
    const builder = createQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await fetchAppointments('admin-1', 'admin');

    expect(builder.eq).not.toHaveBeenCalledWith('user_id', 'admin-1');
  });

  it('reads booked slots from appointment_time with date fallback', async () => {
    const builder = createQueryBuilder({
      data: [
        { appointment_time: '09:00', date: '2026-04-20 | 09:00' },
        { appointment_time: null, date: '2026-04-20 | 10:00' },
      ],
      error: null,
    });
    builder.eq = jest.fn(() => builder);
    builder.neq = jest.fn(() => Promise.resolve({
      data: [
        { appointment_time: '09:00', date: '2026-04-20 | 09:00' },
        { appointment_time: null, date: '2026-04-20 | 10:00' },
      ],
      error: null,
    }));
    mockFrom.mockReturnValue(builder);

    const slots = await fetchBookedSlots('doctor-1', '2026-04-20');

    expect(builder.eq).toHaveBeenNthCalledWith(1, 'doctor_id', 'doctor-1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'appointment_date', '2026-04-20');
    expect(slots).toEqual(['09:00', '10:00']);
  });
});