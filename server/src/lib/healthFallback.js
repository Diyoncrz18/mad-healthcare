'use strict';

const { formatDoctorRecommendations } = require('./clinicContext');

const GENERAL_HEALTH_TERMS = [
  'sakit',
  'nyeri',
  'gejala',
  'penyakit',
  'obat',
  'dokter',
  'klinik',
  'demam',
  'batuk',
  'pilek',
  'flu',
  'pusing',
  'mual',
  'muntah',
  'diare',
  'alergi',
  'ruam',
  'gatal',
  'luka',
  'infeksi',
  'darah',
  'napas',
  'jantung',
  'diabetes',
  'hipertensi',
  'kolesterol',
  'asam lambung',
  'maag',
  'dbd',
  'dengue',
  'covid',
];

const EMERGENCY_PATTERNS = [
  { keyword: 'nyeri dada', label: 'nyeri dada' },
  { keyword: 'dada sakit', label: 'nyeri dada' },
  { keyword: 'sesak napas', label: 'sesak napas' },
  { keyword: 'sulit bernapas', label: 'sulit bernapas' },
  { keyword: 'napas berat', label: 'napas berat' },
  { keyword: 'pingsan', label: 'pingsan' },
  { keyword: 'kejang', label: 'kejang' },
  { keyword: 'muntah darah', label: 'muntah darah' },
  { keyword: 'bab berdarah', label: 'BAB berdarah' },
  { keyword: 'tinja hitam', label: 'tinja hitam' },
  { keyword: 'perdarahan hebat', label: 'perdarahan hebat' },
  { keyword: 'lemah sebelah', label: 'kelemahan satu sisi tubuh' },
  { keyword: 'mulut mencong', label: 'tanda mirip stroke' },
  { keyword: 'bicara pelo', label: 'gangguan bicara mendadak' },
  { keyword: 'kaku kuduk', label: 'kaku kuduk' },
  { keyword: 'bunuh diri', label: 'pikiran menyakiti diri' },
];

const TOPICS = [
  {
    label: 'Demam',
    keywords: ['demam', 'panas', 'meriang', 'menggigil'],
    overview:
      'Demam biasanya tanda tubuh sedang melawan infeksi, tetapi penyebabnya bisa beragam.',
    care: [
      'Ukur suhu tubuh bila ada termometer dan catat durasinya.',
      'Perbanyak cairan, istirahat, dan gunakan pakaian yang nyaman.',
      'Obat penurun panas boleh dipertimbangkan sesuai aturan kemasan bila tidak ada alergi atau larangan dokter.',
    ],
    doctor:
      'Periksa ke dokter bila demam lebih dari 3 hari, sangat tinggi, disertai sesak, ruam luas, nyeri hebat, leher kaku, kejang, atau terjadi pada bayi, lansia, hamil, dan pasien dengan penyakit kronis.',
  },
  {
    label: 'Batuk/flu',
    keywords: ['batuk', 'pilek', 'flu', 'hidung tersumbat', 'radang tenggorokan', 'sakit tenggorokan'],
    overview:
      'Batuk dan pilek sering terkait infeksi saluran napas atas, alergi, iritasi, atau asam lambung.',
    care: [
      'Minum cukup, istirahat, dan hindari asap rokok atau debu.',
      'Gunakan masker bila batuk pilek agar tidak menulari orang sekitar.',
      'Madu dapat membantu batuk pada orang dewasa dan anak di atas 1 tahun.',
    ],
    doctor:
      'Segera periksa bila batuk disertai sesak, nyeri dada, bibir kebiruan, batuk darah, demam tinggi, atau tidak membaik setelah beberapa hari.',
  },
  {
    label: 'Sakit kepala/pusing',
    keywords: ['sakit kepala', 'pusing', 'migrain', 'kepala berat', 'vertigo'],
    overview:
      'Sakit kepala bisa dipicu kurang tidur, dehidrasi, stres, gangguan mata, migrain, tekanan darah, atau infeksi.',
    care: [
      'Coba istirahat di tempat tenang, minum air, dan makan bila terlambat makan.',
      'Catat lokasi nyeri, intensitas, durasi, pemicu, dan obat yang sudah diminum.',
    ],
    doctor:
      'Cari bantuan segera bila sakit kepala muncul mendadak sangat hebat, setelah cedera kepala, disertai lemah sebelah, bicara pelo, demam tinggi, kaku kuduk, kejang, atau gangguan penglihatan.',
  },
  {
    label: 'Diare',
    keywords: ['diare', 'mencret', 'buang air cair', 'bab cair'],
    overview:
      'Diare sering terkait infeksi pencernaan, makanan yang terkontaminasi, intoleransi makanan, atau efek obat.',
    care: [
      'Prioritaskan cairan dan oralit untuk mencegah dehidrasi.',
      'Makan porsi kecil yang mudah dicerna dan hindari makanan berlemak atau sangat pedas dulu.',
      'Cuci tangan dan jaga kebersihan makanan.',
    ],
    doctor:
      'Periksa bila ada darah pada BAB, demam tinggi, tanda dehidrasi, nyeri perut berat, diare lebih dari 2-3 hari, atau terjadi pada bayi/lansia.',
  },
  {
    label: 'Mual/muntah',
    keywords: ['mual', 'muntah', 'enek', 'tidak bisa makan'],
    overview:
      'Mual muntah dapat muncul karena gangguan lambung, infeksi, mabuk perjalanan, kehamilan, efek obat, atau kondisi lain.',
    care: [
      'Minum sedikit-sedikit tetapi sering agar cairan tetap masuk.',
      'Coba makanan hambar dalam porsi kecil setelah muntah mereda.',
      'Hindari makanan berminyak, alkohol, dan bau menyengat sementara.',
    ],
    doctor:
      'Segera periksa bila muntah terus-menerus, muntah darah, nyeri perut berat, tanda dehidrasi, kebingungan, atau disertai sakit kepala hebat.',
  },
  {
    label: 'Maag/asam lambung',
    keywords: ['maag', 'asam lambung', 'gerd', 'ulu hati', 'perih lambung', 'heartburn'],
    overview:
      'Keluhan maag atau asam lambung dapat terasa seperti perih ulu hati, mual, kembung, atau rasa panas di dada.',
    care: [
      'Makan porsi kecil lebih sering dan jangan langsung berbaring setelah makan.',
      'Kurangi kopi, makanan pedas/asam, gorengan, rokok, dan alkohol bila memicu keluhan.',
      'Catat makanan atau kebiasaan yang membuat gejala kambuh.',
    ],
    doctor:
      'Periksa bila nyeri dada berat, muntah darah, tinja hitam, berat badan turun, sulit menelan, atau gejala sering kambuh.',
  },
  {
    label: 'Alergi/ruam/gatal',
    keywords: ['alergi', 'ruam', 'gatal', 'biduran', 'bengkak', 'bentol'],
    overview:
      'Ruam dan gatal bisa terkait alergi, iritasi kulit, infeksi, gigitan serangga, atau kondisi kulit lain.',
    care: [
      'Hindari pemicu yang dicurigai dan jangan menggaruk berlebihan.',
      'Kompres dingin dapat membantu rasa gatal ringan.',
      'Perhatikan apakah ada makanan, obat, kosmetik, atau lingkungan baru sebelum gejala muncul.',
    ],
    doctor:
      'Segera cari pertolongan bila ada bengkak bibir/wajah, sesak napas, pusing berat, atau ruam menyebar cepat setelah makan/obat tertentu.',
  },
  {
    label: 'DBD/dengue',
    keywords: ['dbd', 'dengue', 'demam berdarah', 'bintik merah', 'trombosit'],
    overview:
      'DBD perlu diwaspadai bila demam tinggi disertai nyeri badan, sakit kepala, mual, ruam/bintik merah, mimisan, atau lemas berat.',
    care: [
      'Cukupi cairan dan pantau jumlah buang air kecil.',
      'Hindari aspirin atau ibuprofen kecuali diarahkan dokter karena dapat meningkatkan risiko perdarahan.',
      'Pemeriksaan dokter dan tes darah diperlukan untuk menilai trombosit dan kondisi umum.',
    ],
    doctor:
      'Segera ke fasilitas kesehatan bila ada perdarahan, muntah terus, nyeri perut hebat, sangat lemas, gelisah/mengantuk, tangan kaki dingin, atau tidak bisa minum.',
  },
  {
    label: 'Hipertensi',
    keywords: ['hipertensi', 'tekanan darah', 'darah tinggi', 'tensi tinggi'],
    overview:
      'Tekanan darah tinggi sering tidak bergejala, tetapi tetap perlu dipantau karena berkaitan dengan risiko jantung, stroke, dan ginjal.',
    care: [
      'Ukur tekanan darah saat tenang dan catat angkanya.',
      'Batasi garam, tidur cukup, olahraga sesuai kemampuan, dan minum obat rutin bila sudah diresepkan.',
    ],
    doctor:
      'Segera cari bantuan bila tekanan sangat tinggi disertai nyeri dada, sesak, sakit kepala hebat, gangguan penglihatan, lemah sebelah, atau kebingungan.',
  },
  {
    label: 'Diabetes/gula darah',
    keywords: ['diabetes', 'gula darah', 'kencing manis', 'hiperglikemia', 'hipoglikemia'],
    overview:
      'Keluhan terkait gula darah dapat berupa sering haus, sering kencing, lemas, luka sulit sembuh, atau gemetar/keringat dingin bila gula terlalu rendah.',
    care: [
      'Pantau gula darah bila punya alat dan catat hasilnya.',
      'Ikuti pola makan, aktivitas, dan obat yang sudah dianjurkan tenaga kesehatan.',
      'Jangan menghentikan obat diabetes tanpa arahan dokter.',
    ],
    doctor:
      'Segera cari pertolongan bila sangat lemas, bingung, muntah terus, napas cepat, pingsan, atau gula darah sangat tidak normal.',
  },
  {
    label: 'Nyeri perut',
    keywords: ['sakit perut', 'nyeri perut', 'perut melilit', 'kram perut'],
    overview:
      'Nyeri perut bisa berasal dari lambung, usus, saluran kemih, organ reproduksi, atau kondisi lain.',
    care: [
      'Catat lokasi nyeri, durasi, pola BAB/BAK, makanan terakhir, demam, mual muntah, dan riwayat haid/kehamilan bila relevan.',
      'Minum cukup dan hindari makanan berat sementara bila mual.',
    ],
    doctor:
      'Segera periksa bila nyeri sangat hebat, perut keras, nyeri kanan bawah, muntah terus, demam tinggi, BAB berdarah, pingsan, atau sedang hamil.',
  },
];

function normalize(text) {
  return String(text || '').toLowerCase();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function findEmergencyMatches(text) {
  const lower = normalize(text);
  return unique(
    EMERGENCY_PATTERNS.filter((item) => lower.includes(item.keyword)).map((item) => item.label)
  );
}

function findTopicMatches(text) {
  const lower = normalize(text);
  return TOPICS.filter((topic) => topic.keywords.some((keyword) => lower.includes(keyword)));
}

function isDoctorQuestion(text) {
  const lower = normalize(text);
  return (
    (lower.includes('dokter') || lower.includes('spesialis')) &&
    (lower.includes('siapa') ||
      lower.includes('daftar') ||
      lower.includes('list') ||
      lower.includes('spesialis') ||
      lower.includes('jadwal') ||
      lower.includes('rekomendasi') ||
      lower.includes('rekomendasikan') ||
      lower.includes('cocok') ||
      lower.includes('harus ke') ||
      lower.includes('ke dokter apa'))
  );
}

function isHealthcareRelated(text) {
  const lower = normalize(text);
  return (
    findEmergencyMatches(text).length > 0 ||
    findTopicMatches(text).length > 0 ||
    GENERAL_HEALTH_TERMS.some((term) => lower.includes(term))
  );
}

function formatTopic(topic) {
  return [
    `${topic.label}: ${topic.overview}`,
    '',
    'Yang bisa dilakukan sementara:',
    ...topic.care.map((item) => `- ${item}`),
    '',
    `Kapan perlu dokter: ${topic.doctor}`,
  ].join('\n');
}

function buildHealthcareFallbackReply(
  message,
  { doctorListLine = 'Data dokter belum tersedia.', clinicContext } = {}
) {
  const userText = String(message || '').trim();
  const emergencies = findEmergencyMatches(userText);
  const recommendationLine = formatDoctorRecommendations(userText, clinicContext);
  if (emergencies.length > 0) {
    return [
      `Saya menangkap tanda bahaya: ${emergencies.join(', ')}.`,
      '',
      'Untuk keluhan seperti ini, sebaiknya segera cari pertolongan medis langsung ke IGD atau layanan gawat darurat setempat. Jangan menunggu jawaban chatbot bila gejala sedang berlangsung atau memburuk.',
      '',
      'Sambil menunggu bantuan, posisikan pasien senyaman mungkin, jangan memberi makan/minum bila kesadaran menurun, dan siapkan informasi usia, penyakit/obat rutin, waktu mulai gejala, serta kejadian pemicunya.',
      '',
      'Catatan: saya dapat membantu edukasi awal, tetapi tidak bisa menggantikan pemeriksaan dokter.',
    ].join('\n');
  }

  if (isDoctorQuestion(userText) && recommendationLine) {
    return [
      'Berdasarkan keluhan yang Anda tuliskan, rekomendasi dokter yang paling relevan adalah:',
      '',
      recommendationLine,
      '',
      'Pilih dokter yang jadwalnya cocok di halaman booking. Jika gejala berat, memburuk, atau muncul tanda bahaya, sebaiknya segera ke IGD atau fasilitas kesehatan terdekat.',
      '',
      'Catatan: rekomendasi ini bukan diagnosis pasti dan tetap perlu pemeriksaan dokter.',
    ].join('\n');
  }

  if (isDoctorQuestion(userText)) {
    return [
      'Berikut daftar dokter yang tersedia di CareConnect:',
      '',
      doctorListLine,
      '',
      'Jika Anda menyebutkan keluhan utama, saya bisa bantu arahkan spesialis yang paling relevan untuk konsultasi awal.',
    ].join('\n');
  }

  const topics = findTopicMatches(userText).slice(0, 2);
  if (topics.length > 0) {
    return [
      'Saya bantu menilai secara umum ya. Ini bukan diagnosis pasti, tetapi panduan awal yang aman:',
      '',
      topics.map(formatTopic).join('\n\n'),
      recommendationLine
        ? `\n\nRekomendasi dokter dari data klinik:\n${recommendationLine}`
        : '',
      '',
      'Agar jawabannya lebih tepat, beri tahu usia pasien, sejak kapan keluhan muncul, suhu/angka tekanan atau gula bila ada, obat yang sudah diminum, riwayat penyakit, dan apakah ada tanda bahaya.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (recommendationLine && isHealthcareRelated(userText)) {
    return [
      'Berdasarkan keluhan yang Anda tuliskan, rekomendasi dokter yang paling relevan adalah:',
      '',
      recommendationLine,
      '',
      'Jika keluhan masih ringan dan belum jelas penyebabnya, Dokter Umum bisa menjadi langkah awal. Jika muncul tanda bahaya atau keluhan memburuk, segera ke fasilitas kesehatan terdekat.',
      '',
      'Catatan: rekomendasi ini bukan diagnosis pasti dan tetap perlu pemeriksaan dokter.',
    ].join('\n');
  }

  if (isHealthcareRelated(userText)) {
    return [
      'Saya bisa bantu untuk edukasi kesehatan, gejala, penyakit, pencegahan, dan arahan konsultasi awal.',
      '',
      'Supaya jawabannya sesuai, jelaskan:',
      '- Keluhan utama dan sejak kapan mulai.',
      '- Usia pasien.',
      '- Gejala penyerta seperti demam, nyeri, batuk, sesak, mual, muntah, diare, ruam, atau perdarahan.',
      '- Riwayat penyakit, alergi, kehamilan, dan obat yang sedang digunakan.',
      '',
      'Jika ada nyeri dada, sesak napas, pingsan, kejang, kelemahan satu sisi tubuh, perdarahan hebat, atau penurunan kesadaran, segera ke IGD.',
    ].join('\n');
  }

  return [
    'Saya paling tepat membantu pertanyaan seputar kesehatan, gejala, penyakit, pencegahan, dan pilihan dokter di klinik.',
    '',
    'Coba tuliskan keluhan atau pertanyaan kesehatan Anda, misalnya: "Saya demam 2 hari dan batuk, harus bagaimana?"',
  ].join('\n');
}

module.exports = {
  buildHealthcareFallbackReply,
  findEmergencyMatches,
  findTopicMatches,
  isHealthcareRelated,
  isDoctorQuestion,
};
