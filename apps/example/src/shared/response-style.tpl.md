---
description: Response style selected by a switch-only variable
---

{{#switch style}}
{{#case "concise"}}
Answer in 3 bullets or fewer.
{{/case}}
{{#case "detailed"}}
Explain the reasoning step by step and include trade-offs.
{{/case}}
{{#case "executive"}}
Lead with the recommendation, then include only decision-relevant context.
{{/case}}
{{#default}}
Answer clearly and keep the structure easy to scan.
{{/default}}
{{/switch}}
