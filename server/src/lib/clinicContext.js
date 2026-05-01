'use strict';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const SPECIALTY_GUIDE = [
  {
    specialty: 'Dokter Umum',
    keywords: [
      'demam',
      'panas',
      'batuk',
      'pilek',
      'flu',
      'pusing',
      'lemas',
      'mual',
      'muntah',
      'diare',
      'check up',
      'keluhan umum',
    ],
    reason: 'cocok untuk pemeriksaan awal dan keluhan umum sebelum perlu rujukan spesialis.',
  },
  {
    specialty: 'Dokter Gigi',
    keywords: ['gigi', 'gusi', 'karang gigi', 'sakit gigi', 'berlubang', 'mulut'],
    reason: 'cocok untuk keluhan gigi, gusi, dan mulut.',
  },
  {
    specialty: 'Dokter Anak',
    keywords: ['anak', 'bayi', 'balita', 'imunisasi', 'tumbuh kembang'],
    reason: 'cocok untuk keluhan kesehatan bayi, balita, dan anak.',
  },
  {
    specialty: 'Dokter Mata',
    keywords: ['mata', 'penglihatan', 'buram', 'minus', 'silinder', 'merah', 'berair'],
    reason: 'cocok untuk keluhan penglihatan dan mata.',
  },
  {
    specialty: 'Dokter Jantung',
    keywords: ['jantung', 'nyeri dada', 'dada sakit', 'berdebar', 'hipertensi', 'tekanan darah'],
    reason: 'cocok untuk evaluasi keluhan jantung dan risiko tekanan darah.',
  },
  {
    specialty: 'Dokter Kulit dan Kelamin',
    keywords: ['kulit', 'gatal', 'ruam', 'jerawat', 'alergi', 'biduran', 'kelamin'],
    reason: 'cocok untuk keluhan kulit, rambut, kuku, alergi kulit, dan area kelamin.',
  },
  {
    specialty: 'Dokter Kandungan',
    keywords: ['hamil', 'kehamilan', 'haid', 'menstruasi', 'kandungan', 'reproduksi'],
    reason: 'cocok untuk keluhan kehamilan, menstruasi, dan kesehatan reproduksi.',
  },
  {
    specialty: 'Dokter Penyakit Dalam',
    keywords: ['diabetes', 'gula darah', 'maag', 'asam lambung', 'gerd', 'kolesterol', 'dewasa'],
    reason: 'cocok untuk penyakit kronis dan keluhan organ dalam pada pasien dewasa.',
  },
  {
    specialty: 'Dokter THT',
    keywords: ['telinga', 'hidung', 'tenggorokan', 'sinus', 'tht', 'suara serak'],
    reason: 'cocok untuk keluhan telinga, hidung, tenggorokan, dan sinus.',
  },
  {
    specialty: 'Dokter Saraf',
    keywords: ['saraf', 'migrain', 'kesemutan', 'kebas', 'kejang', 'vertigo', 'stroke'],
    reason: 'cocok untuk keluhan saraf, sakit kepala berat, kesemutan, dan fungsi gerak.',
  },
  {
    specialty: 'Dokter Paru',
    keywords: ['paru', 'sesak', 'napas', 'asma', 'batuk lama', 'batuk darah', 'pernapasan'],
    reason: 'cocok untuk keluhan pernapasan, sesak, asma, dan batuk lama.',
  },
  {
    specialty: 'Dokter Ortopedi',
    keywords: ['tulang', 'sendi', 'otot', 'cedera', 'terkilir', 'lutut', 'punggung', 'ortopedi'],
    reason: 'cocok untuk keluhan tulang, sendi, otot, dan cedera gerak.',
  },
];

function normalize(text) {
  return String(text || '').toLowerCase();
}

function countBy(items, keyFn) {
  const result = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}

function buildScheduleLine(schedules) {
  const activeSchedules = schedules
    .filter((schedule) => schedule?.is_active)
    .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week));

  if (activeSchedules.length === 0) {
    return 'jadwal belum aktif';
  }

  const grouped = new Map();
  for (const schedule of activeSchedules) {
    const time = `${schedule.start_time || '08:00'}-${schedule.end_time || '17:00'}`;
    const dayName = DAY_NAMES[Number(schedule.day_of_week)] || `Hari ${schedule.day_of_week}`;
    if (!grouped.has(time)) grouped.set(time, []);
    grouped.get(time).push(dayName);
  }

  return [...grouped.entries()]
    .map(([time, days]) => `${days.join(', ')} ${time}`)
    .join('; ');
}

function findSpecialtyMatches(message) {
  const lower = normalize(message);
  return SPECIALTY_GUIDE.filter((guide) =>
    guide.keywords.some((keyword) => lower.includes(keyword))
  );
}

function buildClinicContext({ doctors = [], schedules = [], appointments = [] } = {}) {
  const scheduleByDoctor = new Map();
  for (const schedule of schedules) {
    if (!schedule?.doctor_id) continue;
    if (!scheduleByDoctor.has(schedule.doctor_id)) scheduleByDoctor.set(schedule.doctor_id, []);
    scheduleByDoctor.get(schedule.doctor_id).push(schedule);
  }

  const workloadByDoctor = countBy(
    appointments.filter((appointment) => appointment?.status !== 'Cancelled'),
    (appointment) => appointment.doctor_id
  );

  const enrichedDoctors = doctors
    .filter((doctor) => doctor?.id)
    .map((doctor) => ({
      id: doctor.id,
      name: doctor.name || 'Dokter',
      specialty: doctor.specialty || 'Dokter Umum',
      is_active: doctor.is_active !== false,
      scheduleLine: buildScheduleLine(scheduleByDoctor.get(doctor.id) || []),
      upcomingAppointmentCount: workloadByDoctor.get(doctor.id) || 0,
    }))
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      if (a.specialty !== b.specialty) return a.specialty.localeCompare(b.specialty);
      if (a.upcomingAppointmentCount !== b.upcomingAppointmentCount) {
        return a.upcomingAppointmentCount - b.upcomingAppointmentCount;
      }
      return a.name.localeCompare(b.name);
    });

  const activeDoctors = enrichedDoctors.filter((doctor) => doctor.is_active);
  const inactiveDoctors = enrichedDoctors.filter((doctor) => !doctor.is_active);
  const specialtyCounts = countBy(activeDoctors, (doctor) => doctor.specialty);

  const doctorListLine =
    activeDoctors.length > 0
      ? activeDoctors
          .map(
            (doctor, index) =>
              `${index + 1}. ${doctor.name} - ${doctor.specialty} - ${doctor.scheduleLine} - antrean mendatang: ${doctor.upcomingAppointmentCount}`
          )
          .join('\n')
      : 'Belum ada dokter aktif di database.';

  const specialtySummaryLine =
    specialtyCounts.size > 0
      ? [...specialtyCounts.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([specialty, count]) => `${specialty}: ${count} dokter aktif`)
          .join('; ')
      : 'Belum ada spesialis aktif di database.';

  const recommendationGuideLine = SPECIALTY_GUIDE.map(
    (guide) => `- ${guide.specialty}: ${guide.reason}`
  ).join('\n');

  return {
    doctors: enrichedDoctors,
    activeDoctors,
    inactiveDoctors,
    doctorListLine,
    specialtySummaryLine,
    recommendationGuideLine,
  };
}

function formatDoctorRecommendations(message, clinicContext, limitPerSpecialty = 2) {
  const matches = findSpecialtyMatches(message).slice(0, 3);
  if (matches.length === 0) return '';

  const activeDoctors = clinicContext?.activeDoctors || [];
  const lines = [];

  for (const match of matches) {
    const doctors = activeDoctors
      .filter((doctor) => doctor.specialty === match.specialty)
      .sort((a, b) => {
        if (a.upcomingAppointmentCount !== b.upcomingAppointmentCount) {
          return a.upcomingAppointmentCount - b.upcomingAppointmentCount;
        }
        return a.name.localeCompare(b.name);
      })
      .slice(0, limitPerSpecialty);

    if (doctors.length === 0) {
      lines.push(`- ${match.specialty}: ${match.reason} Saat ini belum ada dokter aktif untuk spesialis ini.`);
      continue;
    }

    const doctorNames = doctors
      .map(
        (doctor) =>
          `${doctor.name} (${doctor.scheduleLine}, antrean ${doctor.upcomingAppointmentCount})`
      )
      .join('; ');
    lines.push(`- ${match.specialty}: ${match.reason} Rekomendasi: ${doctorNames}.`);
  }

  return lines.join('\n');
}

module.exports = {
  SPECIALTY_GUIDE,
  buildClinicContext,
  findSpecialtyMatches,
  formatDoctorRecommendations,
};
