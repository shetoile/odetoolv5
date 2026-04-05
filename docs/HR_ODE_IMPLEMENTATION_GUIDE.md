# RH In ODETool

## Executive Summary

The current application can already cover most of your points without a heavy refactor if we use the product the right way:

- `Documentation` becomes the HR database and legal register workspace.
- `Desktop` becomes the organization and governance view for the HR chantier.
- `Execution` becomes the operational follow-up for HR actions.
- `Timeline` becomes the calendar control layer for deadlines, exits, reviews, and compliance actions.

The main gaps today are not the data model itself. The main gaps are:

- native Excel export of procedure/database records is now available from the record table surface
- no enforced access-control model by role
- no compliance-grade audit/retention/security workflow
- no true availability engine for team constitution
- no built-in GPEC pivot/reporting views
- attachment fields can now link annex files dynamically to records, but full compliance-grade retention and access control still need product work

## What Already Exists In The App

### 1. Documentation / Database Surface

The `Documentation` tab already gives you a real data-building surface:

- database tables are inferred from nodes with fields
- records are stored on the table node
- field types already exist for text, number, date, select, yes/no, email, phone, identifier, relation, relation list, node link, formula, and table
- each field can be shown or hidden from the master list
- records can be created, edited, and deleted from the UI
- formulas and relation rollups already exist
- a procedure/document tree can be exported to PDF or DOCX

This is enough to model:

- the RUP
- the personnel database
- the roles table
- simplified fiche de poste data
- simplified competence and GPEC data

### 2. Desktop / Chantier Governance

The chantier model already persists:

- status
- owner
- planning window
- review cadence
- cadence milestones
- capacity plan
- dependencies
- resources
- role model
- required skills
- people plan / GPEC
- indicators
- evidence plan
- signoff owner and signoff state
- acceptance plan
- closure pack
- decision log
- maturity
- transformation impact
- adoption notes
- closure summary
- RETEX

This already matches a large part of your governance need for an HR chantier.

### 3. Execution Surface

The app already supports:

- structured deliverables on nodes
- execution tasks and subtasks
- automatic projection of execution items into the work area
- automatic task status / due date synchronization

There is also a procedure-to-execution automation engine. A database table can automatically create execution tasks if some fields are marked as:

- `execution_owner_node`
- `execution_deliverable`
- `execution_task`
- `execution_subtask`
- `execution_status`
- `execution_due_date`
- `execution_note`

This is a strong fit for HR onboarding, offboarding, permit renewal, annual review, and compliance checks.

### 4. Timeline Surface

The `Timeline` tab already supports:

- yearly planning
- schedule bars
- direct edit of dates and status
- filters by status
- visible scheduling of execution tasks
- blocked/high-priority follow-up

This is enough for:

- onboarding deadlines
- end-of-contract follow-up
- title renewal reminders
- annual review cycles
- training deadlines
- GPEC review cadence

## Recommended Functional Architecture

### General Rule

Your own rule is correct and fits the product well:

`every legal obligation should become a chantier for visibility`

So the right implementation is:

- one dedicated HR chantier for legal and structural RH management
- several related data tables in `Documentation`
- automatic operational tasks in `Execution`
- due-date supervision in `Timeline`

### Recommended Main Chantier

Create one chantier such as:

- `1211 Effectif de l'etablissement`

Inside or around it, structure the HR scope like this:

- `RUP`
- `Base Personnel`
- `Roles ODE`
- `Mouvements RH`
- `Competences`
- `Fiches ODE`
- `GPEC`
- `Disponibilites`

## Best Data Strategy Today

### Recommended Source Of Truth

Today, the best practical model is:

- one main table `Personnel` as the source of truth
- show only legal RUP columns in the master list
- keep extra HR/admin fields in the same table but hidden from the master list

This works better than trying to maintain two separate tables because:

- the app already supports `show in master list`
- the app does not yet support a native derived table/view export for records
- you avoid double entry

So, conceptually:

- `Personnel` = full employee database
- master list of `Personnel` = current in-app RUP view

Important:

- do not store NIR / social security number
- keep foreign-work-permit references outside sensitive free text

## Step By Step Use Of The Current App

### Step 1. Create The HR Chantier

Go to `Desktop`.

Create a structural node for:

- `1211 Effectif de l'etablissement`

Then use the chantier flow already present in the app to treat it as a chantier and fill:

- owner
- planning window
- review cadence
- capacity plan
- role model
- required skills
- people plan
- indicators
- evidence plan
- signoff owner/state
- closure pack

Recommended first values:

- owner: HR lead or direction
- review cadence: monthly
- planning window: annual or quarterly
- indicators: headcount, entries, exits, missing permits, pending onboarding, pending offboarding
- evidence plan: RUP, contracts, title checks, training proofs, exit records

### Step 2. Build The Personnel Table In Documentation

Go to `Documentation`.

Create a database section/table named:

- `Personnel`

Create these fields first:

- `Matricule` -> `identifier`
- `Nom` -> `short_text`
- `Prenom` -> `short_text`
- `Date de naissance` -> `date`
- `Nationalite` -> `short_text`
- `Sexe` -> `single_select`
- `Type de contrat` -> `single_select`
- `Qualification professionnelle` -> `short_text`
- `Date d'embauche` -> `date`
- `Date de sortie` -> `date`
- `Travailleur etranger` -> `yes_no`
- `Type titre travail` -> `short_text`
- `Numero titre travail` -> `identifier`
- `Adresse` -> `long_text`
- `Telephone` -> `phone`
- `Email` -> `email`
- `Niveau habilitation ODE` -> `single_select`
- `Statut RH` -> `formula`

Recommended formula:

- `Statut RH = iif(empty({Date de sortie}), "Actif", "Sorti")`

Recommended `show in master list` fields for the legal register view:

- `Matricule`
- `Nom`
- `Prenom`
- `Date de naissance`
- `Nationalite`
- `Sexe`
- `Type de contrat`
- `Qualification professionnelle`
- `Date d'embauche`
- `Date de sortie`
- `Type titre travail`
- `Numero titre travail`

Recommended hidden fields:

- `Adresse`
- `Telephone`
- `Email`
- internal comments

### Step 3. Handle Special Cases

In the same `Personnel` table, add:

- `Categorie RH` -> `single_select`

Recommended options:

- `Salarie`
- `Stagiaire`
- `Service civique`
- `Interimaire`
- `Detache`
- `Travail a domicile`

This lets you keep one source table while still identifying the special categories required by law.

### Step 4. Manage Annex Documents

For annex files, the safest current approach is not a database attachment field.

Why:

- the data model includes an `attachment` field type
- but the record editor does not currently provide a real record-level file upload flow

So today, use one of these two patterns:

- attach files as procedure/document files in the HR documentation branch
- create dedicated annex sections such as `Titres de travail` and link records to them by note or node link

This is good enough for an internal first pass, but it is not yet the ideal legal implementation.

### Step 5. Create The ODE Roles Table

Create another table:

- `Roles ODE`

Fields:

- `ID role` -> `identifier`
- `Designation` -> `short_text`
- `Droits acces` -> `long_text`
- `Taches responsabilites` -> `long_text`

Create records for:

- `R0 Public`
- `R1 Observateur admis`
- `R2 Observateur souhaite`
- `R3 Acteur`
- `R4 Pilote de chantier`
- `R5 Membre COPIL/CODIR`
- `R6 Representant gouvernance`

Then add to `Personnel`:

- `Role par defaut` -> `relation` to `Roles ODE`

Important:

- this works today as a reference table
- it does not enforce permissions in the app

So this table is operationally useful, but not a true security layer yet.

### Step 6. Create The HR Action Table That Feeds Execution

Create a table:

- `Mouvements RH`

Fields:

- `Collaborateur` -> `relation` to `Personnel`
- `Type mouvement` -> `single_select`
- `Noeud pilote` -> `node_link`
- `Livrable` -> `short_text`
- `Action` -> `short_text`
- `Sous-action` -> `short_text`
- `Statut execution` -> `single_select`
- `Echeance` -> `date`
- `Note` -> `long_text`

Recommended movement types:

- `Embauche`
- `Sortie`
- `Stage`
- `Renouvellement titre`
- `Formation`
- `Entretien annuel`

Set the automation roles like this:

- `Noeud pilote` -> `execution_owner_node`
- `Livrable` -> `execution_deliverable`
- `Action` -> `execution_task`
- `Sous-action` -> `execution_subtask`
- `Statut execution` -> `execution_status`
- `Echeance` -> `execution_due_date`
- `Note` -> `execution_note`

Result:

- each HR movement record can create operational tasks automatically in `Execution`
- those tasks can then be followed in `Timeline`

### Step 7. Use Execution For HR Operations

Go to `Execution`.

Use it for real action management:

- onboarding checklist
- contract signature
- title verification
- workstation/equipment preparation
- training actions
- offboarding actions
- archive and closure actions

Recommended deliverables:

- `Dossier d'embauche complet`
- `Onboarding realise`
- `Controle titre effectue`
- `Sortie admin finalisee`
- `Archivage RUP conforme`

### Step 8. Use Timeline For Compliance Control

Go to `Timeline`.

Use it to supervise:

- due dates from `Mouvements RH`
- end of contract dates
- permit renewal dates
- annual review windows
- training deadlines

Recommended use:

- keep blocked items visible
- use the year view for compliance planning
- review the timeline at each chantier cadence review

## How Each Of Your 7 Points Maps To Current Features

### 1. Registre Unique Du Personnel

Coverage today: `mostly yes`

What already works:

- dedicated chantier
- dedicated database table
- required legal fields
- live updates
- master list view
- document export to PDF/DOCX for branch-level documentation

What is missing:

- native Excel export of the table records
- legal-grade audit trail
- dedicated retention rules and access traceability

### 2. Base De Donnees Du Personnel

Coverage today: `yes`

This is one of the strongest fits with current features.

### 3. Table Des Roles

Coverage today: `yes as reference data`

What already works:

- a roles table
- relation from employees/chantiers to roles
- visible governance data in chantier profile

What is missing:

- real ACL enforcement in the application

### 4. Fiche De Poste ODE

Coverage today: `partially yes`

Practical approach:

- store the employee base data in `Personnel`
- store `N0` to `N5` as a field
- create a matrix table `Fiches ODE`
- use yearly columns or yearly records

This is possible, but the UX is still generic and not yet a dedicated HR screen.

### 5. Profil Competence / Experience

Coverage today: `partially yes`

Possible with current features:

- a `Participations chantier` table
- relations to personnel
- relations to activity class
- role used on each participation
- formulas/rollups to count experience

What is missing:

- a native heatmap/matrix view
- pivots by class and role

### 6. Tableau Des Disponibilites

Coverage today: `weak / partial`

Possible now:

- manual table
- manual planning notes
- timeline visibility of tasks
- capacity text in chantier profile

Missing:

- true people-capacity calendar
- conflict detection by person
- automatic team recommendation

### 7. GPEC Simplifiee

Coverage today: `partial`

Possible now:

- annual GPEC table
- role counts by activity class
- relation to roles and employees
- governance follow-up through chantier people plan

Missing:

- native pivot dashboards
- comparison of current vs target staffing
- direct aggregated reporting

## What The App Still Needs To Add

### Priority 1

- Excel export of database/procedure records, using visible fields only or a selected export profile
- import/export template pack for HR tables
- dedicated record-level attachment support

### Priority 2

- role-based access control enforcement
- reserved-content permissions linked to the roles table
- audit trail on record changes
- retention and archive rules for legal HR data

### Priority 3

- employee availability engine
- capacity conflict detection by collaborator
- GPEC pivot views
- competence heatmap
- automatic generation of a clean legal RUP export from the personnel base

## Recommended Delivery Timeline

### Phase 1. Immediate Configuration With Existing Features

Target: very fast first usable version

- create HR chantier
- create `Personnel`
- create `Roles ODE`
- create `Mouvements RH`
- wire execution automation
- start using `Timeline`

Result:

- you already get a usable HR operating model in the current app

### Phase 2. Minimal Product Additions

Target: make the legal register truly practical

- add Excel export for records
- add record-level attachments
- add HR starter templates

Result:

- legal register becomes materially usable and easy to share

### Phase 3. Governance And Compliance Hardening

Target: make it robust for real organizational use

- ACL and reserved-content enforcement
- audit trail
- retention rules
- access logging

Result:

- the RH module becomes governance-safe, not only operational

### Phase 4. Advanced RH Intelligence

Target: cover your later points well

- availability matrix
- GPEC dashboards
- competence/experience map
- team constitution support with AI

## Final Recommendation

Yes, your intuition is correct:

- the current features already cover most of points `1`, `2`, and `3`
- they cover a usable first pass of points `4`, `5`, and `7`
- they only partially cover point `6`

If we do only one product addition first, it should be:

- `Excel export of procedure/database records`

That is the main blocker between a strong internal HR database and a true deliverable-grade `RUP`.
