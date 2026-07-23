# Authorization middleware examples

`requireAuth` verifies the Better Auth bearer token and loads the matching
`UserProfile` from MongoDB. Role middleware must run after `requireAuth`.

```ts
import {
  allowRoles,
  requireAdmin,
  requireCreator,
  requireSupporter,
} from "../middlewares/authorize.middleware.js";
import { requireAuth } from "../middlewares/require-auth.middleware.js";

router.get("/supporter-only", requireAuth, requireSupporter, controller);

router.post("/creator-only", requireAuth, requireCreator, controller);

router.patch("/admin-only", requireAuth, requireAdmin, controller);

router.get(
  "/creator-or-admin",
  requireAuth,
  allowRoles("creator", "admin"),
  controller,
);
```

Express flattens the `requireAuth` middleware array. Controllers should use
`request.user`, which was loaded from MongoDB using the verified Better Auth
user ID. They must not authorize with email or role values from params, query
strings, or request bodies.

Expected errors pass through the centralized error handler:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

```json
{
  "success": false,
  "message": "You do not have permission for this action"
}
```

Suspended profiles receive HTTP 403 before reaching protected controllers.
