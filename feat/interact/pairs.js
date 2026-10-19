/* Drug-interaction pairs, CLASS level, for the Interactions game. Educational only: no doses.
   kind: 'PD' = pharmacodynamic (the drugs' effects add up or fight), 'PK' = pharmacokinetic (one drug changes
   how much of the other reaches its target: absorption, metabolism enzyme, transporter or kidney clearance).
   m = mechanism id (see MECH), sev = 'major' | 'moderate' | null (fine). */
(function () {
  'use strict';
  const MECH = {
    sero: 'Too much serotonin from two serotonergic drugs',
    bleed: 'Two drugs that each raise bleeding risk',
    kret: 'Both make the kidney keep potassium',
    qt: 'Both block cardiac hERG K⁺ channels (QT prolongation)',
    cyp3a4: 'CYP3A4 inhibition raises the other drug\u2019s level',
    cyp2c9: 'CYP2C9 inhibition raises the other drug\u2019s level',
    cyp1a2: 'CYP1A2 inhibition raises the other drug\u2019s level',
    cyp2c19: 'CYP2C19 inhibition stops a prodrug being activated',
    induce: 'Enzyme induction lowers the other drug\u2019s level',
    pgp: 'P-glycoprotein inhibition raises the other drug\u2019s level',
    renal: 'Less kidney clearance of the other drug',
    cns: 'Additive CNS and breathing depression',
    chelate: 'Binding (chelation) in the gut blocks absorption',
    xo: 'Xanthine oxidase blocked, so the other drug builds up',
    antag: 'Opposite actions at the same receptor (antagonism)',
    tox: 'Additive damage to the same organ',
    folate: 'Two drugs that both block folate pathways',
    avnode: 'Both slow the heart\u2019s SA and AV nodes',
    hypok: 'Low potassium makes the other drug more toxic',
    tyr: 'MAO blocked, so noradrenaline surges (hypertensive crisis)',
    renhemo: 'Both reduce blood flow and filtration in the kidney',
    anticho: 'Additive anticholinergic (muscarinic-blocking) effects',
    mask: 'One drug hides the warning signs of the other\u2019s effect',
    none: 'No meaningful interaction'
  };
  const P = [
    // ---- serotonin ----
    { a: 'SSRI', ae: 'e.g. fluoxetine', b: 'MAO inhibitor', be: 'e.g. phenelzine', sev: 'major', kind: 'PD', m: 'sero', fx: 'Serotonin syndrome: agitation, fever, tremor, clonus', why: 'The SSRI stops serotonin reuptake and the MAOI stops its breakdown, so synaptic serotonin climbs far higher than either drug alone. Long washout periods are needed when switching between them.' },
    { a: 'Linezolid', ae: 'antibiotic', b: 'SSRI', be: 'e.g. sertraline', sev: 'major', kind: 'PD', m: 'sero', fx: 'Serotonin syndrome risk', why: 'Linezolid is an oxazolidinone antibiotic that is also a weak, reversible MAO inhibitor. Added to an SSRI it can push serotonin into the toxic range.' },
    { a: 'Tramadol', ae: 'opioid analgesic', b: 'SSRI', be: 'e.g. paroxetine', sev: 'major', kind: 'PD', m: 'sero', fx: 'Serotonin syndrome and seizure risk', why: 'Tramadol also blocks serotonin and noradrenaline reuptake, so it adds to the SSRI. Some SSRIs (fluoxetine, paroxetine) also inhibit CYP2D6, which changes how tramadol is activated.' },
    { a: 'Non-selective MAOI', ae: 'e.g. tranylcypromine', b: 'Tyramine-rich food', be: 'e.g. aged cheese', sev: 'major', kind: 'PD', m: 'tyr', fx: 'Hypertensive crisis', why: 'Gut and liver MAO-A normally destroy dietary tyramine. With MAO blocked, tyramine reaches nerve endings and releases a flood of noradrenaline, so blood pressure spikes.' },
    { a: 'Levodopa', ae: 'Parkinson\u2019s drug', b: 'Non-selective MAOI', be: 'e.g. phenelzine', sev: 'major', kind: 'PD', m: 'tyr', fx: 'Hypertensive crisis', why: 'Levodopa becomes dopamine and then noradrenaline. With MAO-A blocked these catecholamines are not broken down, so blood pressure can rise dangerously. Selective MAO-B inhibitors are the ones used with levodopa.' },
    // ---- bleeding ----
    { a: 'Warfarin', ae: 'vitamin K antagonist', b: 'NSAID', be: 'e.g. ibuprofen', sev: 'major', kind: 'PD', m: 'bleed', fx: 'Serious bleeding, especially in the gut', why: 'Warfarin lowers clotting factors II, VII, IX and X. NSAIDs block COX-1 in platelets (less thromboxane A\u2082) and injure the stomach lining, so a bleed is both more likely and harder to stop.' },
    { a: 'Warfarin', ae: 'vitamin K antagonist', b: 'SSRI', be: 'e.g. citalopram', sev: 'moderate', kind: 'PD', m: 'bleed', fx: 'Higher bleeding risk', why: 'Platelets cannot make serotonin; they take it up through the same transporter (SERT) that SSRIs block. Serotonin-depleted platelets clump less well, which adds to warfarin\u2019s effect.' },
    { a: 'Warfarin', ae: 'vitamin K antagonist', b: 'Azole antifungal', be: 'e.g. fluconazole', sev: 'major', kind: 'PK', m: 'cyp2c9', fx: 'INR rises, bleeding risk', why: 'The more potent S-enantiomer of warfarin is cleared mainly by CYP2C9. Fluconazole inhibits CYP2C9, so warfarin levels and the INR climb.' },
    { a: 'Warfarin', ae: 'vitamin K antagonist', b: 'Amiodarone', be: 'antiarrhythmic', sev: 'major', kind: 'PK', m: 'cyp2c9', fx: 'INR rises over weeks, bleeding risk', why: 'Amiodarone inhibits CYP2C9 (and other CYPs). Because amiodarone has a very long half-life, the effect builds slowly and lasts long after it is stopped.' },
    { a: 'Warfarin', ae: 'vitamin K antagonist', b: 'Rifampicin', be: 'antibiotic', sev: 'major', kind: 'PK', m: 'induce', fx: 'Warfarin stops working, clot risk', why: 'Rifampicin is a strong inducer of CYP2C9, CYP3A4 and others (via the PXR receptor). Warfarin is cleared faster, the INR falls and clots can form.' },
    // ---- potassium ----
    { a: 'ACE inhibitor', ae: 'e.g. lisinopril', b: 'Potassium-sparing diuretic', be: 'e.g. spironolactone', sev: 'major', kind: 'PD', m: 'kret', fx: 'Hyperkalemia, risk of arrhythmia', why: 'ACE inhibitors lower aldosterone, and spironolactone blocks aldosterone receptors. Both reduce potassium excretion in the collecting duct, so potassium can rise above 6 mmol/L.' },
    { a: 'ARB', ae: 'e.g. losartan', b: 'Potassium supplement', be: '', sev: 'major', kind: 'PD', m: 'kret', fx: 'Hyperkalemia', why: 'ARBs reduce aldosterone\u2019s effect, so the kidney excretes less potassium. Adding extra potassium on top can raise the blood level dangerously, especially if kidney function is reduced.' },
    { a: 'ACE inhibitor', ae: 'e.g. ramipril', b: 'Trimethoprim', be: 'antibiotic', sev: 'moderate', kind: 'PD', m: 'kret', fx: 'Hyperkalemia', why: 'Trimethoprim blocks the epithelial sodium channel (ENaC) in the collecting duct, the same way amiloride does. Less sodium reabsorption means less potassium secretion, on top of the ACE inhibitor.' },
    { a: 'Digoxin', ae: 'cardiac glycoside', b: 'Loop diuretic', be: 'e.g. furosemide', sev: 'moderate', kind: 'PD', m: 'hypok', fx: 'Digoxin toxicity: arrhythmias, nausea, visual changes', why: 'Digoxin and potassium compete for the same site on the Na\u207a/K\u207a-ATPase. When a loop diuretic drops potassium, more digoxin binds and toxicity appears at normal digoxin levels.' },
    // ---- QT ----
    { a: 'Macrolide antibiotic', ae: 'e.g. clarithromycin', b: 'Antipsychotic', be: 'e.g. haloperidol', sev: 'major', kind: 'PD', m: 'qt', fx: 'Long QT, torsades de pointes', why: 'Both block the hERG channel that carries the rapid delayed rectifier current (I\u2096\u1d63). Slower repolarization lengthens the QT interval, and two such drugs together raise the risk of torsades.' },
    { a: 'Ondansetron', ae: 'anti-nausea', b: 'Fluoroquinolone', be: 'e.g. levofloxacin', sev: 'moderate', kind: 'PD', m: 'qt', fx: 'Long QT, arrhythmia risk', why: 'Both prolong the QT interval through hERG block. Low potassium or magnesium makes the combination riskier.' },
    // ---- CYP3A4 ----
    { a: 'Clarithromycin', ae: 'strong CYP3A4 inhibitor', b: 'Simvastatin', be: 'statin', sev: 'major', kind: 'PK', m: 'cyp3a4', fx: 'Myopathy, rhabdomyolysis', why: 'Simvastatin is cleared mostly by CYP3A4. Blocking that enzyme can raise statin exposure many-fold, and high statin levels damage skeletal muscle.' },
    { a: 'Grapefruit juice', ae: 'gut CYP3A4 inhibitor', b: 'Simvastatin', be: 'statin', sev: 'moderate', kind: 'PK', m: 'cyp3a4', fx: 'Higher statin levels, muscle toxicity risk', why: 'Furanocoumarins in grapefruit irreversibly inactivate CYP3A4 in the gut wall, so more simvastatin is absorbed. The effect lasts about a day because new enzyme has to be made.' },
    { a: 'Tacrolimus', ae: 'transplant immunosuppressant', b: 'Clarithromycin', be: 'macrolide', sev: 'major', kind: 'PK', m: 'cyp3a4', fx: 'Tacrolimus toxicity: kidney damage, tremor', why: 'Tacrolimus has a narrow therapeutic window and is cleared by CYP3A4 (and pumped out by P-gp). Clarithromycin blocks both, so levels rise sharply.' },
    { a: 'Tacrolimus', ae: 'transplant immunosuppressant', b: 'Carbamazepine', be: 'anticonvulsant', sev: 'major', kind: 'PK', m: 'induce', fx: 'Low tacrolimus levels, rejection risk', why: 'Carbamazepine induces CYP3A4, so tacrolimus is cleared faster. Levels can fall below the range that protects the transplanted organ.' },
    // ---- CYP2C9 / 1A2 / 2C19 ----
    { a: 'Sulfonylurea', ae: 'e.g. glipizide', b: 'Fluconazole', be: 'azole antifungal', sev: 'moderate', kind: 'PK', m: 'cyp2c9', fx: 'Hypoglycemia', why: 'Most sulfonylureas are metabolized by CYP2C9. Fluconazole inhibits it, so the sulfonylurea lingers and keeps releasing insulin.' },
    { a: 'Theophylline', ae: 'bronchodilator', b: 'Ciprofloxacin', be: 'fluoroquinolone', sev: 'major', kind: 'PK', m: 'cyp1a2', fx: 'Theophylline toxicity: vomiting, arrhythmias, seizures', why: 'Theophylline is cleared mainly by CYP1A2 and has a narrow therapeutic range. Ciprofloxacin inhibits CYP1A2, so levels rise.' },
    { a: 'Clozapine', ae: 'antipsychotic', b: 'Fluvoxamine', be: 'SSRI', sev: 'major', kind: 'PK', m: 'cyp1a2', fx: 'Clozapine toxicity: sedation, low blood pressure, seizures', why: 'Fluvoxamine is a potent CYP1A2 inhibitor, and CYP1A2 is clozapine\u2019s main clearance route. Clozapine levels can rise several-fold.' },
    { a: 'Clopidogrel', ae: 'antiplatelet prodrug', b: 'Omeprazole', be: 'proton pump inhibitor', sev: 'moderate', kind: 'PK', m: 'cyp2c19', fx: 'Weaker antiplatelet effect (clinical impact debated)', why: 'Clopidogrel must be activated by CYP2C19. Omeprazole inhibits CYP2C19, so less active drug forms. Regulators advise avoiding the pair; how much it changes outcomes is still debated, and pantoprazole interacts less.' },
    // ---- transporters / kidney ----
    { a: 'Digoxin', ae: 'cardiac glycoside', b: 'Amiodarone', be: 'antiarrhythmic', sev: 'major', kind: 'PK', m: 'pgp', fx: 'Digoxin toxicity', why: 'Digoxin is pumped out by P-glycoprotein in the gut and kidney. Amiodarone inhibits P-gp, so digoxin levels climb.' },
    { a: 'Lithium', ae: 'mood stabilizer', b: 'Thiazide diuretic', be: 'e.g. bendroflumethiazide', sev: 'major', kind: 'PK', m: 'renal', fx: 'Lithium toxicity: tremor, confusion, ataxia', why: 'Thiazides cause mild sodium loss. The proximal tubule responds by reabsorbing more sodium, and lithium is reabsorbed along with it, so lithium levels rise.' },
    { a: 'Lithium', ae: 'mood stabilizer', b: 'NSAID', be: 'e.g. naproxen', sev: 'major', kind: 'PK', m: 'renal', fx: 'Lithium toxicity', why: 'Prostaglandins help keep kidney blood flow and filtration up. NSAIDs block them, so the kidney clears lithium more slowly.' },
    { a: 'Metformin', ae: 'antidiabetic', b: 'Iodinated contrast', be: 'for CT scans', sev: 'moderate', kind: 'PK', m: 'renal', fx: 'Lactic acidosis if the kidneys are injured', why: 'Metformin is cleared unchanged by the kidney. If contrast causes acute kidney injury, metformin builds up and can cause lactic acidosis, so it is often paused around the scan in people with reduced kidney function.' },
    { a: 'Methotrexate', ae: 'antifolate', b: 'Trimethoprim', be: 'antibiotic', sev: 'major', kind: 'PD', m: 'folate', fx: 'Bone marrow suppression', why: 'Both inhibit dihydrofolate reductase (methotrexate in human cells, trimethoprim weakly as well), and trimethoprim also reduces methotrexate\u2019s kidney clearance. Blood counts can crash.' },
    { a: 'Azathioprine', ae: 'immunosuppressant', b: 'Allopurinol', be: 'gout drug', sev: 'major', kind: 'PK', m: 'xo', fx: 'Severe bone marrow suppression', why: 'Azathioprine becomes 6-mercaptopurine, which xanthine oxidase normally breaks down. Allopurinol blocks xanthine oxidase, so 6-MP and its toxic thioguanine products accumulate.' },
    { a: 'Fluoroquinolone', ae: 'e.g. ciprofloxacin', b: 'Antacid', be: 'magnesium or aluminium', sev: 'moderate', kind: 'PK', m: 'chelate', fx: 'Antibiotic barely absorbed, infection may fail', why: 'Multivalent cations (Mg\u00b2\u207a, Al\u00b3\u207a, Ca\u00b2\u207a, Fe\u00b2\u207a) bind fluoroquinolones in the gut into complexes that cannot be absorbed. Spacing the doses apart avoids it.' },
    { a: 'Levothyroxine', ae: 'thyroid hormone', b: 'Iron supplement', be: '', sev: 'moderate', kind: 'PK', m: 'chelate', fx: 'Less hormone absorbed, hypothyroid symptoms', why: 'Iron (and calcium) binds levothyroxine in the gut. Taking them several hours apart keeps absorption normal.' },
    // ---- CNS ----
    { a: 'Opioid', ae: 'e.g. morphine', b: 'Benzodiazepine', be: 'e.g. diazepam', sev: 'major', kind: 'PD', m: 'cns', fx: 'Deep sedation and respiratory depression', why: 'Opioids act on \u03bc receptors in the brainstem breathing centres; benzodiazepines boost GABA-A inhibition. Together they suppress breathing far more than either alone, so prescribers avoid combining them where possible.' },
    { a: 'Opioid', ae: 'e.g. oxycodone', b: 'Gabapentinoid', be: 'e.g. pregabalin', sev: 'major', kind: 'PD', m: 'cns', fx: 'Respiratory depression', why: 'Gabapentinoids reduce calcium-channel-driven neurotransmitter release and add CNS depression to the opioid. Regulators added breathing warnings for the combination in 2019.' },
    { a: 'Tricyclic antidepressant', ae: 'e.g. amitriptyline', b: 'First-generation antihistamine', be: 'e.g. diphenhydramine', sev: 'moderate', kind: 'PD', m: 'anticho', fx: 'Confusion, dry mouth, constipation, urinary retention', why: 'Both block muscarinic acetylcholine receptors. The anticholinergic load adds up, and older adults are especially prone to confusion.' },
    // ---- antagonism / masking ----
    { a: 'Non-selective beta blocker', ae: 'e.g. propranolol', b: 'Beta-2 agonist inhaler', be: 'e.g. salbutamol', sev: 'major', kind: 'PD', m: 'antag', fx: 'Bronchospasm, reliever stops working in asthma', why: 'Propranolol blocks \u03b2\u2082 receptors in airway smooth muscle, the same receptors salbutamol needs to relax them. In asthma this can trigger severe bronchospasm.' },
    { a: 'Levodopa', ae: 'Parkinson\u2019s drug', b: 'Dopamine antagonist', be: 'e.g. metoclopramide', sev: 'major', kind: 'PD', m: 'antag', fx: 'Worse parkinsonism', why: 'Metoclopramide (and typical antipsychotics) block D\u2082 receptors in the striatum, directly opposing the dopamine levodopa is meant to replace.' },
    { a: 'Insulin', ae: '', b: 'Non-selective beta blocker', be: 'e.g. propranolol', sev: 'moderate', kind: 'PD', m: 'mask', fx: 'Hypoglycemia with fewer warning signs', why: 'Shaking and a racing heart in hypoglycemia are adrenaline effects through \u03b2 receptors. Beta blockade hides them (sweating remains), and it can slow recovery of blood glucose.' },
    { a: 'Beta blocker', ae: 'e.g. metoprolol', b: 'Verapamil', be: 'non-dihydropyridine CCB', sev: 'major', kind: 'PD', m: 'avnode', fx: 'Bradycardia, heart block, heart failure', why: 'Both slow conduction through the SA and AV nodes and reduce contractility. Together they can cause severe bradycardia or complete heart block.' },
    // ---- organ toxicity ----
    { a: 'ACE inhibitor', ae: 'e.g. enalapril', b: 'NSAID', be: 'e.g. ibuprofen', sev: 'moderate', kind: 'PD', m: 'renhemo', fx: 'Acute kidney injury, higher blood pressure', why: 'NSAIDs constrict the afferent arteriole (fewer prostaglandins); ACE inhibitors dilate the efferent one (less angiotensin II). Filtration pressure drops from both ends. Add a diuretic and it is the \u201ctriple whammy\u201d.' },
    { a: 'Aminoglycoside', ae: 'e.g. gentamicin', b: 'Loop diuretic', be: 'e.g. furosemide', sev: 'major', kind: 'PD', m: 'tox', fx: 'Hearing loss, kidney damage', why: 'Both are toxic to the inner ear (loop diuretics affect the stria vascularis, aminoglycosides kill hair cells). Together the risk of permanent hearing loss rises.' },
    { a: 'Vancomycin', ae: 'glycopeptide antibiotic', b: 'Aminoglycoside', be: 'e.g. gentamicin', sev: 'major', kind: 'PD', m: 'tox', fx: 'Acute kidney injury', why: 'Both injure the proximal tubule. Combined, kidney injury is more common, so drug levels and creatinine are monitored closely.' },
    // ---- fine ----
    { a: 'Paracetamol', ae: 'acetaminophen', b: 'Amoxicillin', be: 'antibiotic', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'Different targets and different clearance routes: paracetamol is conjugated in the liver, amoxicillin is excreted by the kidney. They are routinely taken together.' },
    { a: 'Paracetamol', ae: 'acetaminophen', b: 'Ibuprofen', be: 'NSAID', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'They relieve pain by different mechanisms and are commonly alternated or combined for short-term pain and fever.' },
    { a: 'Metformin', ae: 'antidiabetic', b: 'ACE inhibitor', be: 'e.g. lisinopril', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'A very common pairing in diabetes with high blood pressure. ACE inhibitors also protect the kidneys in diabetes.' },
    { a: 'Statin', ae: 'e.g. atorvastatin', b: 'Low-dose aspirin', be: 'antiplatelet', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'Standard together after a heart attack or stroke: one lowers LDL cholesterol, the other stops platelets clumping. No PK or PD clash.' },
    { a: 'Inhaled corticosteroid', ae: 'e.g. budesonide', b: 'Beta-2 agonist inhaler', be: 'e.g. salbutamol', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction (they help each other)', why: 'The steroid treats airway inflammation and the beta-2 agonist relaxes airway muscle. Steroids even increase \u03b2\u2082 receptor expression, so they are paired on purpose.' },
    { a: 'Proton pump inhibitor', ae: 'e.g. omeprazole', b: 'Amoxicillin', be: 'antibiotic', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'Used together on purpose to clear H. pylori: lower stomach acid helps the antibiotics work.' },
    { a: 'Amlodipine', ae: 'dihydropyridine CCB', b: 'ACE inhibitor', be: 'e.g. perindopril', sev: null, kind: 'none', m: 'none', fx: 'No harmful interaction (intended combination)', why: 'A standard blood-pressure combination: blood pressure falls more, which is the goal, and the ACE inhibitor can reduce amlodipine\u2019s ankle swelling.' },
    { a: 'Loratadine', ae: 'second-generation antihistamine', b: 'Paracetamol', be: 'acetaminophen', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'Loratadine barely enters the brain and does not add to sedation; paracetamol does not affect its metabolism.' },
    { a: 'Metformin', ae: 'antidiabetic', b: 'Statin', be: 'e.g. rosuvastatin', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'Commonly prescribed together because diabetes raises cardiovascular risk. Different targets, no clearance clash.' },
    { a: 'Levetiracetam', ae: 'anticonvulsant', b: 'Paracetamol', be: 'acetaminophen', sev: null, kind: 'none', m: 'none', fx: 'No meaningful interaction', why: 'Levetiracetam is mostly cleared unchanged by the kidney and does not induce or inhibit CYP enzymes, which is one reason it is popular in neurology.' }
  ];
  P.forEach((p, i) => { p.id = 'p' + String(i + 1).padStart(2, '0'); p.risky = !!p.sev; });
  window.INTERACT_DATA = { MECH, P };
})();
