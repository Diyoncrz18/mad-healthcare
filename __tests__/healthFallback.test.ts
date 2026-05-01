const {
  buildHealthcareFallbackReply,
  findEmergencyMatches,
  findTopicMatches,
  isHealthcareRelated,
} = require('../server/src/lib/healthFallback');
const { buildClinicContext } = require('../server/src/lib/clinicContext');

describe('healthFallback', () => {
  it('prioritizes emergency symptoms', () => {
    const reply = buildHealthcareFallbackReply('Saya nyeri dada dan sesak napas sejak tadi');

    expect(findEmergencyMatches('nyeri dada dan sesak napas')).toEqual([
      'nyeri dada',
      'sesak napas',
    ]);
    expect(reply).toContain('tanda bahaya');
    expect(reply).toContain('IGD');
  });

  it('answers disease and symptom topics with safe guidance', () => {
    const reply = buildHealthcareFallbackReply('Apa yang harus dilakukan kalau demam dan curiga DBD?');

    expect(findTopicMatches('demam dan DBD').map((topic: any) => topic.label)).toEqual([
      'Demam',
      'DBD/dengue',
    ]);
    expect(reply).toContain('bukan diagnosis pasti');
    expect(reply).toContain('cairan');
    expect(reply).toContain('tes darah');
  });

  it('returns doctor list when asked about clinic doctors', () => {
    const reply = buildHealthcareFallbackReply('Siapa saja dokter spesialis di klinik?', {
      doctorListLine: '1. Dr. Sari - Spesialis Umum',
    });

    expect(reply).toContain('Dr. Sari');
    expect(reply).toContain('spesialis');
  });

  it('recommends doctors from clinic context for symptom questions', () => {
    const clinicContext = buildClinicContext({
      doctors: [
        { id: 'doctor-1', name: 'Dokter Dion S.Ked', specialty: 'Dokter Umum', is_active: true },
        { id: 'doctor-2', name: 'Dokter Nadia S.Ked', specialty: 'Dokter Gigi', is_active: true },
      ],
      schedules: [
        {
          doctor_id: 'doctor-2',
          day_of_week: 1,
          is_active: true,
          start_time: '08:00',
          end_time: '17:00',
        },
      ],
      appointments: [],
    });
    const reply = buildHealthcareFallbackReply('Saya sakit gigi, cocok ke dokter apa?', {
      clinicContext,
      doctorListLine: clinicContext.doctorListLine,
    });

    expect(reply).toContain('Dokter Gigi');
    expect(reply).toContain('Dokter Nadia S.Ked');
    expect(reply).toContain('bukan diagnosis pasti');
  });

  it('redirects non-health questions back to healthcare topics', () => {
    const reply = buildHealthcareFallbackReply('Tolong buatkan puisi tentang hujan');

    expect(isHealthcareRelated('Tolong buatkan puisi tentang hujan')).toBe(false);
    expect(reply).toContain('seputar kesehatan');
  });
});
