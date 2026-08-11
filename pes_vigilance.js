/*
 * Athlete Vigilance Dashboard / PES
 *
 * This module is a decision-support aid for nutrition professionals.
 * It does not establish a medical diagnosis or replace clinical judgment.
 *
 * Risk precedence: RED > ORANGE > YELLOW > GREEN.
 * If critical inputs are unavailable, status is INCOMPLETE rather than GREEN.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'pesVigilanceEvaluation';
  const LEVEL_ORDER = { GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3, INCOMPLETE: -1 };

  const DEFAULT_PES_CATALOG = {
    problems: [
      { id: 'NI-1.1', label: 'Baja disponibilidad energética (LEA)' },
      { id: 'NI-1.2', label: 'Ingesta energética insuficiente' }
    ],
    etiologies: [
      { id: 'E-1.1', label: 'Aumento del gasto por ejercicio no compensado' },
      { id: 'E-3.1', label: 'Conocimientos insuficientes sobre nutrición deportiva' }
    ],
    signs: [
      { id: 'S-1.1', label: 'Amenorrea secundaria' },
      { id: 'S-1.2', label: 'Fatiga persistente' },
      { id: 'S-1.3', label: 'Bajo rendimiento' },
      { id: 'S-1.4', label: 'Oligomenorrea' },
      { id: 'S-1.5', label: 'Fractura por estrés' },
      { id: 'S-1.6', label: 'Bradicardia' }
    ]
  };

  function finiteNumber(value) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }

  function maxLevel(current, candidate) {
    if (!candidate) return current;
    return LEVEL_ORDER[candidate] > LEVEL_ORDER[current] ? candidate : current;
  }

  function evaluateVigilance(data = {}) {
    const reasons = [];
    const ea = finiteNumber(data.eaValue);
    const ferritin = finiteNumber(data.biomarkers && data.biomarkers.ferritin);
    const heartRate = finiteNumber(data.vitals && data.vitals.heartRate);
    const systolic = finiteNumber(data.vitals && data.vitals.systolic);
    const diastolic = finiteNumber(data.vitals && data.vitals.diastolic);
    const orthostaticDrop = finiteNumber(data.vitals && data.vitals.orthostaticSystolicDrop);
    const adolescent = Boolean(data.adolescent);
    const signs = Array.isArray(data.clinicalSigns) ? data.clinicalSigns : [];
    const t3LowQuartile = Boolean(data.biomarkers && data.biomarkers.t3FreeLowQuartile);
    const severeElectrolyte = Boolean(data.electrolytes && data.electrolytes.severeAbnormality);

    const hasCoreEA = ea !== null;
    const hasClinicalInputs = heartRate !== null || systolic !== null || diastolic !== null || signs.length > 0;

    if (!hasCoreEA && !hasClinicalInputs && ferritin === null && !t3LowQuartile && !severeElectrolyte) {
      return {
        level: 'INCOMPLETE',
        reasons: ['Información insuficiente para establecer el nivel de vigilancia.'],
        incomplete: true
      };
    }

    let level = 'GREEN';

    // RED: configured as urgent medical findings. These findings should trigger
    // clinical assessment according to the professional's protocol.
    const severeBradycardia = heartRate !== null && heartRate <= (adolescent ? 45 : 30);
    const severeHypotension = systolic !== null && diastolic !== null && systolic <= 90 && diastolic <= 45;
    const orthostaticIntolerance = orthostaticDrop !== null && orthostaticDrop > 20;

    if (severeBradycardia) {
      level = maxLevel(level, 'RED');
      reasons.push(`Frecuencia cardiaca crítica registrada (${heartRate} lpm).`);
    }
    if (severeHypotension) {
      level = maxLevel(level, 'RED');
      reasons.push(`Presión arterial severamente baja (${systolic}/${diastolic} mmHg).`);
    }
    if (orthostaticIntolerance) {
      level = maxLevel(level, 'RED');
      reasons.push(`Descenso ortostático de PAS >20 mmHg (${orthostaticDrop} mmHg).`);
    }
    if (severeElectrolyte) {
      level = maxLevel(level, 'RED');
      reasons.push('Alteración electrolítica grave registrada.');
    }

    // ORANGE: priority nutrition/RED-S surveillance findings.
    if (ea !== null && ea < 30) {
      level = maxLevel(level, 'ORANGE');
      reasons.push(`Disponibilidad energética crítica (${ea.toFixed(1)} kcal/kg FFM/día).`);
    }
    if (signs.includes('S-1.1') || data.secondaryAmenorrhea === true) {
      level = maxLevel(level, 'ORANGE');
      reasons.push('Amenorrea secundaria registrada.');
    }
    if (t3LowQuartile) {
      level = maxLevel(level, 'ORANGE');
      reasons.push('T3 libre registrada en el cuartil inferior del rango de referencia.');
    }
    if (ferritin !== null && ferritin < 12) {
      level = maxLevel(level, 'ORANGE');
      reasons.push(`Ferritina baja (${ferritin} µg/L).`);
    }

    // YELLOW: professional surveillance.
    if (ea !== null && ea >= 30 && ea < 45) {
      level = maxLevel(level, 'YELLOW');
      reasons.push(`Disponibilidad energética en zona de vigilancia (${ea.toFixed(1)} kcal/kg FFM/día).`);
    }
    if (signs.includes('S-1.4') || data.oligomenorrhea === true) {
      level = maxLevel(level, 'YELLOW');
      reasons.push('Oligomenorrea registrada.');
    }
    if (ferritin !== null && ferritin >= 12 && ferritin < 30) {
      level = maxLevel(level, 'YELLOW');
      reasons.push(`Ferritina en zona de vigilancia (${ferritin} µg/L).`);
    }

    if (level === 'GREEN' && ea !== null && ea >= 45 && reasons.length === 0) {
      reasons.push('EA ≥45 kcal/kg FFM/día y no se identificaron indicadores de riesgo configurados.');
    }

    if (level === 'GREEN' && ea === null) {
      return {
        level: 'INCOMPLETE',
        reasons: ['Falta la disponibilidad energética (EA); no se asigna Verde por defecto.'],
        incomplete: true
      };
    }

    return { level, reasons, incomplete: false };
  }

  function getElementValue(ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') return el.checked;
        return el.value !== undefined ? el.value : el.textContent;
      }
    }
    return null;
  }

  function readDataFromUI() {
    const ea = getElementValue(['ea-value', 'eval-ea', 'vigilance-ea', 'eaValue']);
    const ferritin = getElementValue(['val-bio-ferritina', 'ferritin', 'vigilance-ferritin']);
    const hr = getElementValue(['val-clin-fc', 'heart-rate', 'vigilance-heart-rate']);
    const systolic = getElementValue(['val-clin-pas', 'systolic', 'vigilance-systolic']);
    const diastolic = getElementValue(['val-clin-pad', 'diastolic', 'vigilance-diastolic']);
    const secondaryAmenorrhea = getElementValue(['vigilance-amenorrhea']);
    const oligomenorrhea = getElementValue(['vigilance-oligomenorrhea']);
    const t3LowQuartile = getElementValue(['vigilance-t3-low']);
    const severeElectrolyte = getElementValue(['vigilance-electrolytes']);

    const signsSelect = document.getElementById('pes-signs');
    const clinicalSigns = signsSelect
      ? Array.from(signsSelect.selectedOptions || []).map(option => option.value).filter(Boolean)
      : [];

    return {
      eaValue: ea,
      biomarkers: { ferritin, t3FreeLowQuartile: Boolean(t3LowQuartile) },
      vitals: { heartRate: hr, systolic, diastolic },
      electrolytes: { severeAbnormality: Boolean(severeElectrolyte) },
      clinicalSigns,
      secondaryAmenorrhea: Boolean(secondaryAmenorrhea),
      oligomenorrhea: Boolean(oligomenorrhea)
    };
  }

  function levelLabel(level) {
    return {
      RED: 'Rojo — valoración médica prioritaria',
      ORANGE: 'Naranja — valoración prioritaria',
      YELLOW: 'Amarillo — vigilancia profesional',
      GREEN: 'Verde — sin indicadores de riesgo configurados',
      INCOMPLETE: 'Información incompleta — no se puede clasificar'
    }[level] || level;
  }

  function updateUI(result) {
    const container = document.getElementById('vigilance-light');
    if (!container) return;

    container.querySelectorAll('.dot').forEach(dot => {
      dot.classList.toggle('active', dot.dataset.level === result.level.toLowerCase());
      dot.setAttribute('aria-current', dot.classList.contains('active') ? 'true' : 'false');
    });

    const status = document.getElementById('vigilance-status');
    if (status) status.textContent = levelLabel(result.level);

    const reasons = document.getElementById('vigilance-reasons');
    if (reasons) {
      reasons.innerHTML = '';
      result.reasons.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        reasons.appendChild(li);
      });
    }

    const hidden = document.getElementById('vigilance-result');
    if (hidden) hidden.value = result.level;
  }

  function persist(result, rawInputs) {
    const payload = {
      timestamp: new Date().toISOString(),
      riskLevel: result.level,
      reasons: result.reasons,
      rawInputs
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem('vigilanceLevel', result.level);
  }

  function populateSelect(selectId, items, multiple) {
    const select = document.getElementById(selectId);
    if (!select || select.options.length > 1) return;
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = selectId === 'pes-problem' ? 'Seleccione el problema' :
      selectId === 'pes-etiology' ? 'Seleccione la etiología' : 'Seleccione signos/síntomas';
    if (!multiple) placeholder.selected = true;
    select.appendChild(placeholder);

    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function normalizeCatalog(raw) {
    if (!raw) return DEFAULT_PES_CATALOG;
    if (raw.problems && raw.etiologies && raw.signs) return raw;
    if (raw.problemas && raw.etiologias && raw.signos) {
      return { problems: raw.problemas, etiologies: raw.etiologias, signs: raw.signos };
    }
    return DEFAULT_PES_CATALOG;
  }

  async function loadCatalog() {
    const candidates = ['catalogo pes.txt', 'pes_catalog.json', 'catalog.json'];
    for (const path of candidates) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) continue;
        const text = await response.text();
        try {
          return normalizeCatalog(JSON.parse(text));
        } catch (_) {
          // Plain text catalog: retain safe defaults until the structured catalog is available.
        }
      } catch (_) {
        // Continue to the next candidate.
      }
    }
    return DEFAULT_PES_CATALOG;
  }

  function updatePESStatement() {
    const problem = document.getElementById('pes-problem');
    const etiology = document.getElementById('pes-etiology');
    const signs = document.getElementById('pes-signs');
    const textarea = document.getElementById('pes-diagnosis');
    if (!problem || !etiology || !signs || !textarea || textarea.dataset.manual === 'true') return;

    const p = problem.selectedOptions[0] && problem.selectedOptions[0].value ? problem.selectedOptions[0].textContent : '';
    const e = etiology.selectedOptions[0] && etiology.selectedOptions[0].value ? etiology.selectedOptions[0].textContent : '';
    const s = Array.from(signs.selectedOptions || []).map(o => o.textContent).filter(Boolean).join(' y ');

    if (p && e && s) textarea.value = `${p} relacionada con ${e}, evidenciada por ${s}.`;
    else if (p && e) textarea.value = `${p} relacionada con ${e}.`;
    else textarea.value = '';
  }

  async function init() {
    const catalog = await loadCatalog();
    populateSelect('pes-problem', catalog.problems || []);
    populateSelect('pes-etiology', catalog.etiologies || []);
    populateSelect('pes-signs', catalog.signs || [], true);

    ['pes-problem', 'pes-etiology', 'pes-signs'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        updatePESStatement();
        window.updateVigilance();
      });
    });

    const textarea = document.getElementById('pes-diagnosis');
    if (textarea) textarea.addEventListener('input', () => { textarea.dataset.manual = 'true'; });

    window.updateVigilance();
  }

  window.evaluateVigilance = evaluateVigilance;
  window.updateVigilance = function () {
    const rawInputs = readDataFromUI();
    const result = evaluateVigilance(rawInputs);
    updateUI(result);
    persist(result, rawInputs);
    return result;
  };

  document.addEventListener('DOMContentLoaded', init);
})();
