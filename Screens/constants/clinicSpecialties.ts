import { Ionicons } from '@expo/vector-icons';

export type ClinicSpecialtyTone =
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'doctor';

export type ClinicSpecialty = {
  key: string;
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: ClinicSpecialtyTone;
  summary: string;
  services: string[];
  whenToVisit: string[];
  duration: string;
};

export const CLINIC_SPECIALTIES: ClinicSpecialty[] = [
  {
    key: 'umum',
    name: 'Umum',
    title: 'Dokter Umum',
    icon: 'medkit',
    tone: 'brand',
    summary: 'Pemeriksaan awal untuk keluhan umum, kontrol kesehatan, dan rujukan bila perlu.',
    services: ['Konsultasi keluhan ringan', 'Pemeriksaan fisik', 'Surat rujukan'],
    whenToVisit: ['Demam', 'Batuk pilek', 'Pusing atau lemas'],
    duration: '15-25 menit',
  },
  {
    key: 'gigi',
    name: 'Gigi',
    title: 'Dokter Gigi',
    icon: 'happy',
    tone: 'info',
    summary: 'Perawatan gigi dan mulut untuk menjaga fungsi kunyah, kebersihan, dan kenyamanan.',
    services: ['Pemeriksaan gigi', 'Pembersihan karang', 'Tambal gigi'],
    whenToVisit: ['Sakit gigi', 'Gusi berdarah', 'Gigi berlubang'],
    duration: '20-40 menit',
  },
  {
    key: 'anak',
    name: 'Anak',
    title: 'Dokter Anak',
    icon: 'people',
    tone: 'success',
    summary: 'Layanan kesehatan anak dari pemantauan tumbuh kembang sampai keluhan harian.',
    services: ['Konsultasi anak', 'Pantau tumbuh kembang', 'Edukasi imunisasi'],
    whenToVisit: ['Demam anak', 'Sulit makan', 'Batuk berkepanjangan'],
    duration: '20-30 menit',
  },
  {
    key: 'mata',
    name: 'Mata',
    title: 'Dokter Mata',
    icon: 'eye',
    tone: 'warning',
    summary: 'Pemeriksaan penglihatan dan keluhan mata agar aktivitas tetap nyaman.',
    services: ['Cek penglihatan', 'Keluhan mata merah', 'Evaluasi minus atau silinder'],
    whenToVisit: ['Penglihatan buram', 'Mata nyeri', 'Mata berair'],
    duration: '20-35 menit',
  },
  {
    key: 'jantung',
    name: 'Jantung',
    title: 'Dokter Jantung',
    icon: 'heart',
    tone: 'danger',
    summary: 'Konsultasi risiko dan keluhan jantung dengan evaluasi medis yang terarah.',
    services: ['Konsultasi kardiologi', 'Evaluasi tekanan darah', 'Saran pemeriksaan lanjut'],
    whenToVisit: ['Nyeri dada', 'Berdebar', 'Mudah sesak'],
    duration: '25-40 menit',
  },
  {
    key: 'kulit',
    name: 'Kulit',
    title: 'Dokter Kulit dan Kelamin',
    icon: 'hand-left',
    tone: 'doctor',
    summary: 'Perawatan keluhan kulit, rambut, kuku, dan area sensitif secara profesional.',
    services: ['Konsultasi kulit', 'Evaluasi jerawat', 'Keluhan alergi kulit'],
    whenToVisit: ['Ruam', 'Gatal menetap', 'Jerawat meradang'],
    duration: '20-35 menit',
  },
  {
    key: 'kandungan',
    name: 'Kandungan',
    title: 'Dokter Kandungan',
    icon: 'female',
    tone: 'brand',
    summary: 'Konsultasi kesehatan reproduksi, kehamilan, dan keluhan kandungan.',
    services: ['Konsultasi kehamilan', 'Keluhan menstruasi', 'Edukasi kesehatan reproduksi'],
    whenToVisit: ['Telat haid', 'Nyeri haid berat', 'Kontrol kehamilan'],
    duration: '25-40 menit',
  },
  {
    key: 'penyakit-dalam',
    name: 'Penyakit Dalam',
    title: 'Dokter Penyakit Dalam',
    icon: 'body',
    tone: 'info',
    summary: 'Evaluasi keluhan organ dalam dan penyakit kronis pada pasien dewasa.',
    services: ['Kontrol penyakit kronis', 'Evaluasi hasil lab', 'Konsultasi metabolik'],
    whenToVisit: ['Diabetes', 'Hipertensi', 'Keluhan lambung berulang'],
    duration: '25-40 menit',
  },
  {
    key: 'tht',
    name: 'THT',
    title: 'Dokter THT',
    icon: 'ear',
    tone: 'success',
    summary: 'Penanganan keluhan telinga, hidung, tenggorokan, dan area kepala leher terkait.',
    services: ['Pemeriksaan telinga', 'Keluhan sinus', 'Evaluasi tenggorokan'],
    whenToVisit: ['Telinga sakit', 'Hidung tersumbat', 'Suara serak'],
    duration: '20-35 menit',
  },
  {
    key: 'saraf',
    name: 'Saraf',
    title: 'Dokter Saraf',
    icon: 'git-network',
    tone: 'warning',
    summary: 'Konsultasi gangguan saraf, nyeri kepala, kesemutan, dan fungsi gerak.',
    services: ['Evaluasi nyeri kepala', 'Keluhan kesemutan', 'Pemeriksaan fungsi saraf'],
    whenToVisit: ['Migrain', 'Kebas', 'Nyeri menjalar'],
    duration: '25-45 menit',
  },
  {
    key: 'paru',
    name: 'Paru',
    title: 'Dokter Paru',
    icon: 'cloudy',
    tone: 'doctor',
    summary: 'Konsultasi sistem pernapasan untuk batuk, sesak, dan keluhan paru lainnya.',
    services: ['Konsultasi pernapasan', 'Evaluasi batuk lama', 'Saran pemeriksaan lanjut'],
    whenToVisit: ['Sesak napas', 'Batuk lebih dari 2 minggu', 'Nyeri saat bernapas'],
    duration: '25-40 menit',
  },
  {
    key: 'ortopedi',
    name: 'Ortopedi',
    title: 'Dokter Ortopedi',
    icon: 'walk',
    tone: 'danger',
    summary: 'Evaluasi tulang, sendi, otot, dan cedera gerak untuk aktivitas yang lebih nyaman.',
    services: ['Keluhan sendi', 'Cedera olahraga', 'Evaluasi nyeri tulang'],
    whenToVisit: ['Nyeri lutut', 'Cedera terkilir', 'Nyeri punggung'],
    duration: '25-40 menit',
  },
];
