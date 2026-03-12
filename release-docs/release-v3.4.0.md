# Release v3.4.0 Deployment Guide

This document outlines the detailed deployment steps, environment changes, migrations, and post-deployment form updates for the **v3.4.0 production release** across multiple microservices.

---

## General Notes

-   All environment variables must be verified before deployment.
-   Execute migration scripts only after successful deployment of each respective service.
-   For Docker-based deployments, update the image tag to the latest version as specified for each service.
-   For PM2 deployments, use the specified branch name.

> ⚠️ **For cURLs mentioned, Token and domain values vary based on environment: make sure you pass valid token and domain for the environment. Valid token can be optained from engineering team. Due to security issues token is not provided in the documentation**
>
> -   **Elevate Prod:** `https://elevate-apis.shikshalokam.org`
> -   **SaaS Prod:** `https://elevate-api.sunbirdsaas.com`
> -   **SaaS QA:** `https://saas-qa.tekdinext.com`

---

## Interface Service

### 1. Environment Details

(Provided after comparison with staging environment)

```json
{
	"REQUIRED_PACKAGES": "elevate-project@1.1.53 elevate-survey-observation@1.0.23", // update these values
	"ROUTE_CONFIG_JSON_URLS_PATHS": "https://raw.githubusercontent.com/ELEVATE-Project/utils/refs/heads/master/interface-routes/elevate-routes.json"
}
```

> ⚠️ `APPLICATION_ENV` value in production is currently `develop`. Please verify the correct value before deployment.

### 2. Migration

_No migrations applicable._

### 3. PM2 Deployment

-   **Branch:** `master`

### 4. Docker Deployment

    verify the existing tag. if not matching update it

-   **Image Tag:** `shikshalokamqa/elevate-interface:3.3.2`

---

## User Service

### 1. PM2 Deployment

-   **Branch:** `master`

### 2. Docker Deployment

    verify the existing tag. if not matching update it

-   **Image Tag:** `shikshalokamqa/elevate-user:3.4.0`

---

## scheduler Service

### 1. PM2 Deployment

-   **Branch:** `master`

### 2. Docker Deployment

    verify the existing tag. if not matching update it

-   **Image Tag:** `shikshalokamqa/elevate-scheduler:3.4.0`

---

## Project Service

### 1. Environment Changes

**Add (if not present):**

```
"ADMIN_AUTH_TOKEN": "N0DM5NAwwCN5KNXKJwlwu6c0nQQt6Rcl" //This is a sample
"AUTH_CONFIG_FILE_PATH": "config.json"
"AUTH_METHOD": "native"
"ENABLE_REFLECTION": "true"
"ENTITY_MONGODB_URL": "mongodb://localhost:27017/saas_elevate_entity" // replace with prod entity DB URL
"KAFKA_HEALTH_CHECK_TOPIC": "project-health-check-topic-check"
"SERVICE_NAME": "project"
"SOURCE_MONGODB_URL": "mongodb://172.30.158.134:27017/elevate-project"
"SURVEY_MONGODB_URL": "mongodb://localhost:27017/saas_qa_samiksha" // replace with prod survey DB URL
"USER_COURSES_SUBMISSION_TOPIC": "elevate_user_courses_prod"
"USER_COURSES_TOPIC": "elevate_user_courses_prod_raw"
"RESOURCE_DELETION_TOPIC": "resource_deletion_topic_prod"
"ORG_UPDATES_TOPIC" : "elevate_project_org_extension_event_listener"
"SUBMISSION_TOPIC: : "saas_project_submission_prod"
```

**Update:**

```
"DEFAULT_ORGANISATION_CODE": "default_code"
```

### 2. Migrations

After deployment, run the following scripts sequentially:

```bash
# M1. Normalize orgIds in multiple collections
cd migrations/correctOrgIdValuesInCollections
node correctOrgIdValuesInCollections.js

# M2. Normalize orgIds in solution scopes
cd migrations/correctScopeOrgValues
node correctScopeOrgValues.js

# M3. Update program components
cd migrations/updateComponentInPrograms
node updateComponentInPrograms.js

# M4. Create default org policies
cd migrations/createOrgExtensions
node createOrgExtensions.js
```

### 3. PM2 Deployment

-   **Branch:** `main`

### 4. Docker Deployment

-   **Image Tag:** `shikshalokamqa/elevate-project-service:3.4.0`

---

## Samiksha Service (Survey Service)

### 1. Environment Changes

**Add:**

```
"AUTH_CONFIG_FILE_PATH": "config.json"
"KAFKA_HEALTH_CHECK_TOPIC": "survey-health-check-topic-check"
"SUBMISSION_UPDATE_KAFKA_PUSH_ON_OFF": "ON"
"USER_COURSES_SUBMISSION_TOPIC": "elevate_user_courses_prod"
"USER_COURSES_TOPIC": "elevate_user_courses_prod_raw"
"RESOURCE_DELETION_TOPIC": "resource_deletion_topic_prod"
"IMPROVEMENT_PROJECT_SUBMISSION_TOPIC": saas_project_submission_prod // should be same as SUBMISSION_TOPIC of project service
```

**Update:**

```
"APP_PORTAL_DIRECTORY": "/observations/"
```

### 2. Migrations

```bash
# M1. Normalize orgIds in multiple collections
cd migrations/normalizeOrgIdInCollections
node normalizeOrgIdInCollections.js

# M2. Normalize orgIds in scope of solutions
cd migrations/correctScopeOrgValues
node correctScopeOrgValues.js

# M3. Update program components
cd migrations/
node updateComponentsOfAllPrograms.js

# M4. Create default org policies
cd migrations/createOrgExtensions
node createOrgExtensions.js
```

### 3. PM2 Deployment

-   **Branch:** `main`

### 4. Docker Deployment

-   **Image Tag:** `shikshalokamqa/elevate-samiksha-service:3.4.0_RC1`

---

## Entity Management Service

### 1. Environment Changes

**Add:**

```
"ADMIN_ACCESS_TOKEN": "N0DM5NAwwCN5KNXKJwlwu6c0nQQt6Rcl"
"KAFKA_COMMUNICATIONS_ON_OFF": "ON"
"KAFKA_GROUP_ID": "qa.entity"
"KAFKA_HEALTH_CHECK_TOPIC": "entity-health-check-topic-check"
"KAFKA_URL": "172.30.148.74:9092"
"RESOURCE_DELETION_TOPIC": "resource_deletion_topic_prod"
```

### 2. Migration

```bash
cd migrations/
node normalizeOrgIdInCollections.js
```

### 3. PM2 Deployment

-   **Branch:** `main`

### 4. Docker Deployment

-   **Image Tag:** `shikshalokamqa/elevate-entity-management:3.4`

---

## Project PWA

### 1. Branch

-   **Branch:** `release-3.4.0`

### 2. Docker Deployment

-   Update **Docker image tag** with: `shikshalokamqa/elevate-project-obervation-pwa:3.4.0.1`

### 3. Form Creation

```
curl '{{domain}}/project/v1/profile/read' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'if-none-match: W/"975-sdn13+NyT5hfSyxj+XqiZY2UnA8"' \
  -H 'org-id: 33' \
  -H 'origin: {{domain}}' \
  -H 'priority: u=1, i' \
  -H 'referer: {{domain}}' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'x-auth-token: <token>'
```

### 4. Form Update

```
curl '{{domain}}/user/v1/form/read' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: {{domain}}' \
  -H 'Referer: {{domain}}' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'X-auth-token: <token>' \
  -H 'org-id: 64' \
  --data-raw '{"type":"homelist","sub_type":"homelists"}'
```

Update object paths:

```json
{
	"name": "Reports",
	"img": "assets/images/ic_report.svg",
	"redirectionUrl": "/project-report",
	"listType": "report",
	"reportPage": true,
	"description": "Make sense of data to enable your decision-making based on your programs with ease",
	"list": [
		{
			"name": "Improvement Project Reports",
			"img": "assets/images/ic_project.svg",
			"redirectionUrl": "/project-report",
			"listType": "project",
			"solutionType": "improvementProject",
			"reportPage": false,
			"description": "Manage and track your school improvement easily, by creating tasks and planning project timelines"
		},
		{
			"name": "Survey Reports",
			"img": "assets/images/ic_survey.svg",
			"redirectionUrl": "/observations/listing/surveyReports",
			"listType": "survey",
			"solutionType": "survey",
			"reportPage": true,
			"reportIdentifier": "surveyReportPage",
			"description": "Provide information and feedback through quick and easy surveys",
			"customNavigation": true
		},
		{
			"name": "Observation Reports",
			"img": "assets/images/ic_observation.svg",
			"redirectionUrl": "/observations/listing/observationReports",
			"listType": "listing",
			"solutionType": "observation",
			"reportPage": true,
			"reportIdentifier": "surveyReportPage",
			"description": "Provide information and feedback through quick and easy observations",
			"customNavigation": true
		}
	]
}
```

---

## Observation Portal

### New Portal – Nginx Configuration Check

-   Check whether the `/observations` route is already configured in Nginx.
-   If it exists, no changes are required.
-   If it does not exist, add a new Nginx configuration entry for `/observations`.

### 1. Branch

-   **Branch:** `release-3.4.0`

### 2. Docker Deployment

-   Update **Docker image tag** for Observation/Survey PWA: `shikshalokamqa/elevate-observation-portal:3.4.1`

### 3. Forms Creation

```
curl '{{domain}}/survey/v1/configurations/read' \
  -H 'X-auth-token: <token>' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'Referer: {{domain}}' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'org-id: 35'
```

```
curl '{{domain}}/survey/v1/profile/read' \
  -H 'X-auth-token: <token>' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'Referer: {{domain}}' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'org-id: 35'
```

---

## Elevate Portal

### 1. Branch

-   **Branch:** `release-1.1.0`

### 2. Docker Deployment

-   Update **React-wrapper/Shikshagraha app** image tag: `shikshalokamqa/elevate-portal:1.1.3`

### 3. Form Update

```
curl '{{domain}}/user/v1/organization-feature/read' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Connection: keep-alive' \
  -H 'If-None-Match: W/"fe0-wmpsaTaC6Mk5wEX4XEY9MMSV7x8"' \
  -H 'Origin: https://app.shikshagraha.org' \
  -H 'Referer: https://app.shikshagraha.org/' \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'X-Auth-Token: <token>' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"'
```

```json
{
  "organization_code": "default_code",
  "feature_code": "survey",
  "tenant_code": "shikshagraha",
  "enabled": true,
  "feature_name": "survey",
  "meta": {
    "url": "/observations/listing/survey",
    "icon": "/assets/images/ic_survey.png",
    "theme": {
      "primaryColor": "#572E91",
      "secondaryColor": "#FF9911"
    },
    "title": "Survey",
    "sameOrigin": true
  },
  "display_order": 3
},
{
  "organization_code": "default_code",
  "feature_code": "observation",
  "tenant_code": "shikshagraha",
  "enabled": true,
  "feature_name": "Observation",
  "meta": {
    "url": "/observations/listing/observation",
    "icon": "/assets/images/ic_observation.svg",
    "theme": {
      "primaryColor": "#572E91",
      "secondaryColor": "#FF9911"
    },
    "title": "Observations",
    "sameOrigin": true
  },
  "display_order": 4
}
```

#### shikshagraha Tenant

```
curl '{{domain}}/user/v1/form/read' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'content-type: application/json' \
  -H 'origin: https://app.shikshagraha.org' \
  -H 'priority: u=1, i' \
  -H 'referer: https://app.shikshagraha.org/' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  --data-raw '{"type":"user","sub_type":"registration"}'
```

```json
    "meta": {
                    "registration_code": {
                        "name": "State",
                        "value_ref": "externalId"
                    }
                }

```

```json
{
	"hint": null,
	"name": "password",
	"type": "text",
	"label": "Password",
	"order": "6",
	"fieldId": null,
	"options": [],
	"pattern": "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[~!@#$%^&*()_+`\\-={}:\";'<>?,./\\\\])(?!.*\\s).{8,}$",
	"policyMsg": "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, a special character, and no spaces.",
	"coreField": 1,
	"dependsOn": null,
	"isEditable": true,
	"isPIIField": true,
	"isRequired": true,
	"validation": ["password"],
	"placeholder": "ENTER_PASSWORD",
	"isMultiSelect": false,
	"maxSelections": 0,
	"sourceDetails": {}
}
```

#### shikshalokam Tenant

```
curl '{{domain}}/user/v1/form/read' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'content-type: application/json' \
  -H 'origin: https://app.shikshagraha.org' \
  -H 'priority: u=1, i' \
  -H 'referer: https://app.shikshagraha.org/' \
  -H 'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Linux"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: cross-site' \
  -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36' \
  --data-raw '{"type":"user","sub_type":"registration"}'
```

```json
{
	"hint": null,
	"name": "password",
	"type": "text",
	"label": "Password",
	"order": "6",
	"fieldId": null,
	"options": [],
	"pattern": "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[~!@#$%^&*()_+`\\-={}:\";'<>?,./\\\\])(?!.*\\s).{8,}$",
	"policyMsg": "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, a special character, and no spaces.",
	"coreField": 1,
	"dependsOn": null,
	"isEditable": true,
	"isPIIField": true,
	"isRequired": true,
	"validation": ["password"],
	"placeholder": "ENTER_PASSWORD",
	"isMultiSelect": false,
	"maxSelections": 0,
	"sourceDetails": {}
}
```

---
