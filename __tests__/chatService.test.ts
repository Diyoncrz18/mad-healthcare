const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

jest.mock('../Screens/services/authService', () => ({
  getCurrentUser: () => mockGetUser(),
}));

import {
  fetchChatContacts,
  getOrCreateConversation,
  sendMessage,
} from '../Screens/services/chatService';
import { createQueryBuilder } from './testUtils';

describe('chatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: 'user-1', user_metadata: { role: 'user' } });
  });

  it('fetches active doctors as patient chat contacts', async () => {
    // Logic: pasien boleh chat semua dokter aktif yang punya akun chat.
    const builder = createQueryBuilder({
      data: [
        {
          id: 'doctor-1',
          user_id: 'doctor-user-1',
          name: 'Dr. Sari',
          specialty: 'Umum',
        },
        // Dokter tanpa user_id belum bisa chat dan harus disembunyikan.
        {
          id: 'doctor-2',
          user_id: null,
          name: 'Dr. Belum Terhubung',
          specialty: 'Gigi',
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const contacts = await fetchChatContacts('user');

    expect(mockFrom).toHaveBeenCalledWith('doctors');
    expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    expect(builder.order).toHaveBeenCalledWith('name');
    expect(contacts).toEqual([
      {
        id: 'doctor-1',
        userId: 'doctor-user-1',
        name: 'Dr. Sari',
        subtitle: 'Umum',
        role: 'doctor',
      },
    ]);
  });

  it('fetches patients as doctor chat contacts from appointments only', async () => {
    mockGetUser.mockResolvedValue({ id: 'doctor-user-1', user_metadata: { role: 'doctor' } });

    // First .from('doctors') → return current doctor row.
    // Second .from('appointments') → return appointment list.
    const doctorBuilder = createQueryBuilder({
      data: { id: 'doctor-1', user_id: 'doctor-user-1' },
      error: null,
    });
    const appointmentBuilder = createQueryBuilder({
      data: [
        { user_id: 'patient-1', patient_name: 'Budi' },
        // Duplikasi appointment dari pasien yang sama: harus unique.
        { user_id: 'patient-1', patient_name: 'Budi' },
      ],
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(doctorBuilder)
      .mockReturnValueOnce(appointmentBuilder);

    const contacts = await fetchChatContacts('doctor');

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'doctors');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'appointments');
    expect(appointmentBuilder.eq).toHaveBeenCalledWith('doctor_id', 'doctor-1');
    expect(appointmentBuilder.in).toHaveBeenCalledWith(
      'status',
      ['pending', 'Confirmed', 'Diproses', 'Selesai']
    );
    expect(contacts).toEqual([
      {
        id: 'patient-1',
        userId: 'patient-1',
        name: 'Budi',
        subtitle: 'Pasien',
        role: 'user',
      },
    ]);
  });

  it('gets an existing conversation by patient and doctor pair', async () => {
    const existing = {
      id: 'conversation-1',
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
      created_at: '2026-04-29',
      updated_at: '2026-04-29',
    };
    const builder = createQueryBuilder({ data: existing, error: null });
    mockFrom.mockReturnValue(builder);

    const conversation = await getOrCreateConversation('patient-1', 'doctor-1');

    expect(mockFrom).toHaveBeenCalledWith('chat_conversations');
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'patient_id', 'patient-1');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'doctor_id', 'doctor-1');
    expect(builder.insert).not.toHaveBeenCalled();
    expect(conversation).toEqual(existing);
  });

  it('rejects empty messages', async () => {
    await expect(sendMessage('conversation-1', '   ')).rejects.toThrow('Pesan tidak boleh kosong.');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('inserts a trimmed valid message from current user', async () => {
    const builder = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);
    mockGetUser.mockResolvedValue({ id: 'sender-1', user_metadata: { role: 'user' } });

    await sendMessage('conversation-1', '  Halo dokter  ');

    expect(mockFrom).toHaveBeenCalledWith('chat_messages');
    expect(builder.insert).toHaveBeenCalledWith([
      {
        conversation_id: 'conversation-1',
        sender_id: 'sender-1',
        message: 'Halo dokter',
      },
    ]);
  });
});
