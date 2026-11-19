# QA Thinking — Day 55

## From QA Toward DevOps and Cloud Engineering: Test a Deployment's Failure and Recovery

The pipeline is green and the new container is running. Customers still receive errors because the process accepts traffic before initialization finishes. The deployment completed technically, but the product did not remain usable.

This is a useful entry into DevOps and cloud engineering: extend your investigation from application behavior to how software is built, deployed, observed, and recovered. The following is a proposed practice lab for a small service, not a report of a deployment executed here.

### 1. Understand the delivery path

```text
Commit -> checks -> build artifact -> deploy -> verify behavior -> observe
                                                   |
                                            recover if needed
```

An **artifact** is the deployable output, such as a container image. Identify its version or digest so the deployed build can be connected to the code and checks that produced it. **Infrastructure as code** records resource configuration in versioned files so changes can be reviewed and applied repeatably.

For a practice service, make the pipeline show the tested revision, deployed artifact, target environment, and verification results. When a stage fails, retain enough evidence to identify whether the problem came from application code, packaging, infrastructure, credentials, or test setup.

### 2. Learn the health checks by breaking their assumptions

Kubernetes distinguishes three probe purposes: startup checks initialization, readiness controls whether a Pod should receive service traffic, and liveness can trigger a container restart. A configured startup probe gates the other probes until startup succeeds. [Kubernetes probe documentation](https://kubernetes.io/docs/concepts/workloads/pods/probes/)

| Experiment in an isolated lab | What to investigate |
| --- | --- |
| Slow initialization | Does the service stay out of traffic until ready? |
| A process that is running but cannot serve requests | Can readiness reflect the meaningful service condition? |
| A deadlocked process | Does the liveness policy recover it within the intended bounds? |
| A shared dependency outage | Does the configuration avoid turning one outage into repeated restart storms? |
| A new version with broken behavior | Does deployment verification detect the user-facing failure? |

Choose dependencies in probes carefully with engineering. A database outage does not necessarily mean restarting every application instance is helpful. Readiness also needs thought: excluding every instance may remove all service capacity.

### 3. Verify the product after deployment

A small post-deployment check might create an isolated report request, observe completion within the agreed deadline, retrieve the result, and clean it up. Check access as well as availability. Keep the workload bounded so verification does not distort the service it measures.

Define user-facing indicators alongside infrastructure health. For this service, request success rate, request latency, and report-completion delay may describe different risks. Agree objectives and measurement windows rather than treating a single passing smoke check as an availability claim. [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)

### 4. Rehearse recovery with data compatibility in view

Deploy a deliberately faulty build only in the lab. Confirm which signal detects it and who or what initiates recovery. Measure when useful service returns, not only when the rollback command exits.

Rolling back an application image does not automatically reverse database changes or queued messages. Test whether the previous version can read the current schema and messages. If recovery requires a forward fix or data repair, document and rehearse that route instead.

For cloud practice, extend the experiment to identity permissions, network access, storage, and resource teardown. Check current service documentation and pricing before provisioning. A local Kubernetes lab can teach deployment behavior without proving a managed cloud environment's identity or network policies.

### 5. Build experience through small owned improvements

An SDET might improve reliable deployment checks. Someone exploring DevOps might improve the pipeline and its feedback. Someone exploring cloud engineering might provision the isolated environment and demonstrate recovery. Work with the people who operate the actual service and be explicit about what you owned.

Bolton's automation guidance is a useful reminder to choose observations with meaningful expected outcomes. “Deployment command succeeded” and “users can finish their work” need different evidence. [Automation guidance](https://developsense.com/blog/2018/06/which-test-cases-should-i-automate)

### Practical challenge: one broken rollout

Create or plan a local lab with a tiny service, a versioned image, a readiness condition, and a post-deployment behavior check. Introduce a slow startup or a failing endpoint. Record the timeline from deployment to detection to recovery. Finish with an evidence report: what failed, which signal caught it, what restored service, what happened to data, and what the lab does not establish about production.
