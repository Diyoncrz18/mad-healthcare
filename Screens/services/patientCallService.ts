import { supabase } from '../../supabase';
import { getDefaultBackendUrl, resolveBackendUrl } from './backendUrl';

const CALL_BACKEND_URL = resolveBackendUrl(
  (process.env.EXPO_PUBLIC_SOCKET_URL as string | undefined) ||
    (process.env.EXPO_PUBLIC_HEALTHBOT_URL as string | undefined),
  getDefaultBackendUrl()
);

export type PatientCallPayload = {
  appointmentId: string;
  notificationId: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  title: string;
  message: string;
  createdAt: string;
};

export const callPatientToRoom = async (
  appointmentId: string
): Promise<PatientCallPayload> => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sesi berakhir. Silakan login ulang.');

  const response = await fetch(
    `${CALL_BACKEND_URL}/appointments/${appointmentId}/call-patient`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const body = await response.json().catch(() => ({} as any));
  if (!response.ok || !body?.call) {
    throw new Error(
      body?.message ||
        body?.error ||
        'Server belum bisa memanggil pasien. Pastikan backend berjalan.'
    );
  }

  return body.call as PatientCallPayload;
};
