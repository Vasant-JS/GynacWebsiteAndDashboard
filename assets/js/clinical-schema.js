(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Clinical = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const yn = ['Yes', 'No', 'Unsure'];
  const text = (key, label) => ({ key, label, type: 'textarea' });
  const select = (key, label, options = yn, showWhen) => ({ key, label, type: 'select', options, showWhen });
  const number = (key, label, min, max) => ({ key, label, type: 'number', min, max });
  const sections = [
    { title: 'Chief complaints', fields: [text('complaint', 'Main complaints'), text('complaintDuration', 'Duration of complaints'), text('symptoms', 'Associated symptoms'), text('previousTreatment', 'Previous consultations and treatments')] },
    { title: 'Obstetric history', fields: [
      select('pregnancyStatus', 'Current pregnancy status'),
      { key: 'lmp', label: 'First day of last menstrual period (LMP)', type: 'date' },
      number('cycleLength', 'Cycle length for estimated due date (days; default 28)', 20, 44),
      { key: 'assessmentDate', label: 'Assessment date for gestation', type: 'date' },
      { key: 'gpal', label: 'G / P / A / L', type: 'text' },
      select('deliveryType', 'Previous pregnancy delivery', ['PTVD', 'FTVD', 'Caesarean section', 'No previous pregnancy']),
      text('caesareanIndication', 'Indication for Caesarean section'),
      { key: 'children', label: 'Previous pregnancy children', type: 'children' },
      text('pastPregnancyComplications', 'Previous pregnancy complications'), text('pregnancyComplications', 'Current pregnancy complications'),
      select('usgAvailable', 'Ultrasound (USG) reports available'), select('antenatalRecords', 'Antenatal records available'),
      select('bloodGroup', 'Blood group', ['A', 'B', 'AB', 'O']), select('rh', 'Rh factor', ['Positive', 'Negative']),
      select('antiD', 'Anti-D administered', yn, ['rh', 'Negative']),
      select('ictPerformed', 'Indirect Coombs Test (ICT) performed', yn, ['rh', 'Negative']),
      select('ictResult', 'ICT result', ['Negative', 'Positive'], ['ictPerformed', 'Yes']),
      select('highRisk', 'High-risk pregnancy'),
    ] },
    { title: 'Menstrual history', fields: [select('cyclePattern', 'Menstrual cycle', ['Regular', 'Irregular', 'Missed']), number('menstrualCycleLength', 'Menstrual cycle length (days)', 1, 365), number('bleedingDays', 'Duration of menstrual bleeding (days)', 0, 90),
      { key: 'menstrualComplaints', label: 'Present menstrual / gynecological complaints', type: 'multi', options: ['Painful periods', 'Heavy Menstrual Bleeding (HMB)', 'Irregular cycles', 'PMOS/PCOS', 'Discharge PV', 'Itching'] },
      text('otherMenstrualComplaints', 'Other complaints'), select('maritalStatus', 'Marital status', ['Single', 'Married', 'Divorced', 'Widowed', 'Other', 'Prefer not to say']), text('contraception', 'Contraceptive use and details'), text('infertilityWorkup', 'Previous infertility investigations / workup')] },
    { title: 'Medical history', fields: [
      { key: 'medicalConditions', label: 'Medical conditions', type: 'multi', options: ['Type 1 Diabetes Mellitus', 'Type 2 Diabetes Mellitus', 'Hypertension', 'Thyroid disorders', 'Bronchial Asthma', 'Coronary Artery Disease'] },
      text('otherMedicalConditions', 'Other medical conditions'), select('transfusions', 'Past transfusions'), text('surgeries', 'Previous surgeries'), text('drugAllergies', 'Drug allergies and details'),
    ] },
    { title: 'Family history', fields: [text('familyHistory', 'Family history')] },
    { title: 'Physical measurements', fields: [number('heightCm', 'Height (cm)', 30, 250), number('weightKg', 'Weight (kg)', 1, 500), number('waistCm', 'Waist circumference (cm)', 10, 300), number('hipCm', 'Hip circumference (cm)', 10, 300)] },
    { title: 'Diagnosis and treatment plan', fields: [text('diagnosis', 'Provisional diagnosis'), text('treatment', 'Treatment plan'), text('investigations', 'Investigations advised'), select('followUpRequired', 'Follow-up required'), { key: 'followUpDate', label: 'Suggested follow-up date', type: 'date' }, select('referralRequired', 'Referral required'), text('referralDetails', 'Referral details')] },
  ];
  const fields = sections.flatMap((section) => section.fields);
  function dateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }
  function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function calculations(data) {
    const height = Number(data.heightCm), weight = Number(data.weightKg);
    const bmi = height > 0 && weight > 0 ? Math.round(weight / ((height / 100) ** 2) * 10) / 10 : null;
    const lmp = dateValue(data.lmp), assessment = dateValue(data.assessmentDate || today());
    const pregnancy = data.pregnancyStatus === 'Yes' || data.pregnancyStatus === 'Unsure';
    const days = lmp && assessment ? Math.floor((assessment - lmp) / 86400000) : -1;
    const valid = pregnancy && days >= 0 && days <= 315;
    const dueDate = valid ? new Date(lmp.getTime() + (280 + (Number(data.cycleLength) || 28) - 28) * 86400000).toISOString().slice(0, 10) : null;
    return { bmi, dueDate, gestationWeeks: valid ? Math.floor(days / 7) : null, gestationDays: valid ? days % 7 : null };
  }
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Case sheet must be an object.');
    const data = {};
    for (const field of fields) {
      const value = input[field.key];
      if (field.type === 'children') {
        if (value != null && !Array.isArray(value)) throw new Error('Children must be a list.');
        if ((value || []).length > 30) throw new Error('Too many child entries.');
        data.children = (value || []).map((child) => {
          if (!child || typeof child !== 'object') throw new Error('Invalid child entry.');
          const age = child.age === '' || child.age == null ? null : Number(child.age);
          if (age !== null && (!Number.isFinite(age) || age < 0 || age > 120)) throw new Error('Child age must be between 0 and 120.');
          if (child.gender && !['Male', 'Female', 'Other', 'Unknown'].includes(child.gender)) throw new Error('Invalid child gender.');
          return { gender: child.gender || '', age, notes: String(child.notes || '').trim().slice(0, 1000) };
        });
      } else if (field.type === 'multi') {
        if (value != null && !Array.isArray(value)) throw new Error(field.label + ' must be a list.');
        if ((value || []).some((item) => !field.options.includes(item))) throw new Error('Invalid ' + field.label.toLowerCase() + '.');
        data[field.key] = [...new Set(value || [])];
      } else if (value === '' || value == null) data[field.key] = '';
      else if (field.type === 'number') {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < field.min || numeric > field.max) throw new Error(field.label + ' is outside the allowed range.');
        data[field.key] = numeric;
      } else if (field.type === 'select') {
        if (!field.options.includes(value)) throw new Error('Invalid ' + field.label.toLowerCase() + '.');
        data[field.key] = value;
      } else if (field.type === 'date') {
        if (!dateValue(value)) throw new Error('Invalid ' + field.label.toLowerCase() + '.');
        data[field.key] = value;
      } else {
        if (typeof value !== 'string' || value.length > 10000) throw new Error(field.label + ' must be text of at most 10,000 characters.');
        data[field.key] = value.trim();
      }
    }
    if (data.lmp && data.lmp > (data.assessmentDate || today())) throw new Error('LMP cannot be later than the assessment date.');
    if (data.rh !== 'Negative') { data.antiD = ''; data.ictPerformed = ''; data.ictResult = ''; }
    if (data.ictPerformed !== 'Yes') data.ictResult = '';
    return data;
  }
  return { sections, fields, normalize, calculations, dateValue, today };
});
