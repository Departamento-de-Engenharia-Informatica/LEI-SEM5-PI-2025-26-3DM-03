#  US 4.1.14 – Manage Complementary Task Categories

## 1. Requirements Engineering

### 1.1. User Story Description
As a Logistics Operator, I want to manage Complementary Task Categories so that complementary tasks can be created with standardized category codes, names, and default duration metadata.

---

### 1.2. Customer Specifications and Clarifications
- The SPA provides a management page for complementary task categories with:
  - list + search by free text (`q`)
  - create/update/delete actions
- Category fields:
  - `code` (required)
  - `name` (required)
  - `description` (optional)
  - `defaultDurationMinutes` (optional)
- UI validation rules:
  - `code` must match `^CTC\d{3,}$` (e.g., `CTC001`, `CTC1234`).
  - `name` is required and must have at least 2 characters.
  - `defaultDurationMinutes` must be numeric when provided.
  - `code` is normalized to uppercase before submission.
- Calls are executed through the TodoApi proxy (`/api/oem/complementary-task-categories*`).

---

### 1.3. Acceptance Criteria

| ID  | Acceptance Criterion                                                         | Status      |
|-----|-------------------------------------------------------------------------------|-------------|
| AC1 | API supports listing/searching categories by free text.                       | Implemented |
| AC2 | API supports CRUD for complementary task categories.                          | Implemented |
| AC3 | SPA provides a screen with form validation for creating/updating categories.  | Implemented |

---

### 1.4. Dependencies

| Dependency                               | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| OEM service (NestJS)                     | Owns category persistence and query/search                                  |
| TodoApi `OemProxyController`             | Proxies `/api/oem/complementary-task-categories*` calls to OEM              |
| IAM / Auth cookies/JWT                   | Required by TodoApi `[Authorize]`                                            |
| Complementary Tasks (US 4.1.15)          | Tasks reference categories by `categoryId`                                   |

---

### 1.5. Input and Output Data

**Input (SPA → API):**
- `GET /api/oem/complementary-task-categories?q=...`
- `POST /api/oem/complementary-task-categories` body:
  - `code` *(string, required)*
  - `name` *(string, required)*
  - `description` *(string, optional/nullable)*
  - `defaultDurationMinutes` *(number, optional/nullable)*
- `PATCH /api/oem/complementary-task-categories/{id}` partial body (same fields)

**Output (API → SPA):**
- `ComplementaryTaskCategoryDTO[]`
  - `id`, `code`, `name`, `description?`, `defaultDurationMinutes?`, `createdAt?`

---

### 1.6. Main Endpoints

| Method | Endpoint                                   | Description                         | Example |
|-------:|---------------------------------------------|-------------------------------------|---------|
| GET    | /api/oem/complementary-task-categories      | List categories (optional `q`)      | `/api/oem/complementary-task-categories?q=clean` |
| GET    | /api/oem/complementary-task-categories/{id} | Get category by id                  | `/api/oem/complementary-task-categories/2` |
| POST   | /api/oem/complementary-task-categories      | Create category                     | `/api/oem/complementary-task-categories` |
| PATCH  | /api/oem/complementary-task-categories/{id} | Update category                     | `/api/oem/complementary-task-categories/2` |
| DELETE | /api/oem/complementary-task-categories/{id} | Delete category                     | `/api/oem/complementary-task-categories/2` |

---

### 1.7. Example Requests (Postman)
```
# Search categories
GET /api/oem/complementary-task-categories?q=maintenance

# Create category
POST /api/oem/complementary-task-categories
Content-Type: application/json
{
  "code": "CTC001",
  "name": "Maintenance",
  "description": "Non-planned maintenance tasks",
  "defaultDurationMinutes": 60
}

# Update category
PATCH /api/oem/complementary-task-categories/2
Content-Type: application/json
{
  "name": "Maintenance & Repairs",
  "defaultDurationMinutes": 90
}

# Delete category
DELETE /api/oem/complementary-task-categories/2
```

---

### 1.8. Bootstrap Data (Seeding)
- No mandatory seeding. Categories can be created through the UI.

---

### 1.9. System Architecture (Summary)
- **Frontend:** Angular `ComplementaryTaskCategoriesComponent` uses `ComplementaryTaskCategoriesService`.
- **Gateway:** TodoApi `OemProxyController` proxies `/api/oem/complementary-task-categories*`.
- **OEM service:** NestJS `ComplementaryTaskCategoryController` implements list/search and CRUD.

---

### 1.10. Remarks
- The ARQSI PlantUML files under `Docs/Sprint C/arqsi/US 4.1.14` are mislabeled and should be corrected if they are meant to describe this feature.
