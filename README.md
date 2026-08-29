# Matapon

Matapon is a project-building system for turning a product idea into a clear, buildable application specification before implementation.

## Core Flow

Product truth → Schema → Validation → Platform → Build specification → Application

The system should help determine what the product actually requires without adding architecture merely because it is conventional.

Once a product decision is settled, it stays settled unless a real contradiction appears.

---

## Schema Creator

The Schema Creator is a visual surface for designing and validating the relational database schema.

It supports:

- tables
- fields
- definitions
- foreign keys
- choices
- field details
- table notes
- tags
- product truths
- naming guidance
- schema validation
- broken foreign-key detection
- duplicate-name detection
- naming-convention checks
- automatic naming suggestions
- JSON import/export

It should help answer:

- What does this table represent?
- Why does this field exist?
- Is something reusable or a specific occurrence?
- Is something a choice, table, relationship, or exception?
- Does a foreign key point to a real field?
- Does naming match the rest of the system?
- Is structure required by the product or merely conventional?

---

## Platform Creator

The Platform Creator captures the technical shape of the application.

### Repository

Monorepo:

- `frontend/`
- `backend/`

### Frontend

- React
- React Router
- reusable token-based CSS
- Netlify

### Backend

- Node.js
- Express
- TypeScript
- Zod
- Pure SQL
- Railway

---

## Naming Conventions

Database tables:

`plural_snake_case`

Database fields:

`snake_case`

Foreign keys:

`singular_target_id`

React components:

`PascalCase.tsx`

TypeScript modules:

`camelCase.ts`

API routes:

`/api/plural-resources`

Environment variables:

`UPPER_SNAKE_CASE`

Examples:

`activities`

`event_activities`

`staff_members`

`activity_id → activities.id`

`event_activity_id → event_activities.id`

`staff_member_id → staff_members.id`

Avoid malformed names such as:

`activitys`

`event_activitys`

---

## Intended Repository Shape

mataponapp/
- frontend/
  - src/
    - components/
    - pages/
    - routes/
    - api/
    - styles/
      - tokens.css
      - global.css
- backend/
  - src/
    - routes/
    - db/
      - schema.sql
      - queries/
    - validation/
    - services/
- README.md

---

## Current Status

- Git repository created
- GitHub remote connected
- Initial commit pushed
- Schema Creator prototype created
- Platform Creator prototype created
- Initial naming and validation rules established

## Next

Move the current HTML builder into the repository and continue developing Matapon as the tool for defining a solid application structure before generating the actual application.
