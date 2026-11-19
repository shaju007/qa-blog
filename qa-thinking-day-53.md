# QA Thinking — Day 53

## Cloud Testing: Check Identity, Network Boundaries, Recovery, and Cost Alongside the API

Your API tests pass on a developer's machine. In a cloud environment, the API cannot publish events because its workload identity lacks permission. A public storage setting exposes reports. A queue backlog grows unnoticed. None of those problems requires a change to the endpoint's business logic.

Cloud testing includes the application and the infrastructure that lets it operate. This lesson uses an invented API that queues report-generation jobs. The exercises describe experiments to perform in an owned test environment; they are not results from an executed cloud deployment.

### 1. Draw the resources and trust boundaries

```text
Browser -> HTTPS endpoint -> Report API -> Job queue -> Worker
                                  |                     |
                             Metadata DB           Report storage
```

**Identity** answers who is acting. **Permissions** describe what that identity may do. A **network boundary** controls which connections can reach a resource. Successful connectivity does not establish authorization, and correct identity permissions do not establish private networking.

Name the application's cloud identity, the worker's identity, the test runner's identity, and the account or project owning the resources. Then write the allowed actions: the API can enqueue jobs; the worker can read jobs and store reports; users can retrieve only their own reports.

### 2. Turn architecture concerns into experiments

AWS Well-Architected provides questions about operating cloud systems across reliability, security, performance, cost, and other concerns. The following test matrix is an original application of that lens, not a provider certification checklist. [AWS Well-Architected](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)

| Concern | Controlled experiment | Evidence |
| --- | --- | --- |
| Identity and permissions | Run the API with its intended identity, then an identity missing queue access | Useful error, no false success, and an observable authorization failure |
| Tenant isolation | Request advertiser A's report as advertiser B | Denied retrieval, including the stored object's download path |
| Network access | Connect from an allowed location and an intentionally excluded location | Expected connectivity without exposing private resources publicly |
| Worker failure | Stop one test worker after a job starts | Job recovery with no duplicate user-visible report under the agreed policy |
| Data recovery | Restore a known backup into a separate environment | Expected records, readable reports, and measured recovery time |
| Cost and cleanup | Run a bounded workload and destroy its resources | Resource inventory, usage estimate, and teardown evidence |

Actual queue delivery, acknowledgement, retry, and retention behavior depends on the chosen service and configuration. Read that service's documentation before assigning expected outcomes.

### 3. Observe more than an HTTP response

For our example, `202 Accepted` means the job was accepted under the API contract. It does not mean the report was generated. Track a job ID through acceptance, queueing, processing, storage, and authorized retrieval.

A **metric** can show the age of the oldest queued job. A **trace** can connect work across instrumented services. A **log** can describe a particular failure. OpenTelemetry documents these distinct signal types; you still need to choose useful instrumentation and correlation for your product. [OpenTelemetry signals](https://opentelemetry.io/docs/concepts/signals/)

Ask whether a user would learn that a report failed even if they never read the operational dashboard. Test the user-facing failure and the operational signal separately.

### 4. Distinguish local evidence from cloud evidence

A local container setup can demonstrate application behavior under a stopped worker. An emulator can provide convenient feedback on requests. Neither establishes that your real cloud identity, network routes, storage policy, or managed-service configuration is correct.

Keep a small set of checks against a dedicated cloud environment. Record the region, service configuration, deployment version, resource IDs, and test data. Include cleanup for failed runs and a resource inventory afterward; a successful API deletion alone may leave storage versions or other billable resources.

Measure costs with the provider's current pricing and observed usage rather than copying a fixed price into the test plan. Set a bounded workload and a cleanup deadline before running it.

### 5. Ask recovery questions before a failure

Agree how much data loss is acceptable and how quickly service must return. Those are product and operational decisions. Then test the restore procedure against a known dataset and check that access policies also survive recovery.

Bolton's automation guidance is useful here: automate repeatable checks such as owned-resource inventories, while investigating whether your recovery evidence represents the actual user risk. [Automation guidance](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### Practical challenge: one resource failure

Choose queue permissions, report storage access, or worker interruption. Write the normal flow, inject one controlled fault in an isolated environment, predict user-visible and operational outcomes, and list the evidence needed to distinguish an application bug from infrastructure configuration. If you cannot run it yet, label the result as an experiment plan and record the missing access or setup.
