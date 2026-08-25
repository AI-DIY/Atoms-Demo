# Host Responses API Configuration

## Goal

Registered and returning users enter Agent Studio's Builder immediately. Every model request uses one server-managed Responses API configuration supplied by the Linux host rather than a user database record.

## Chosen approach

The Next.js process receives configuration through `process.env`. In production, systemd already loads `/etc/agent-studio.env` with `EnvironmentFile=`, so that root-owned host file is the single source of truth. The application accepts `RESPONSES_API_BASE_URL`, `RESPONSES_API_KEY`, `RESPONSES_MODEL`, `RESPONSES_MAX_OUTPUT_TOKENS`, and `RESPONSES_REASONING_EFFORT`; it validates all required values before creating an OpenAI provider.

This preserves `MOCK_LLM=true` for local and automated demonstrations. Production sets it to `false`, requires the unified Responses values, and never falls back to a database configuration.

## User flow

1. A visitor registers or logs in.
2. The authenticated app shell renders the Builder directly.
3. Team, mention, and iteration requests resolve the same host configuration on the server.
4. No browser code or API response contains the API key.

## Removed surface

The onboarding wizard, model configuration form, sidebar settings entry, client API calls, and model-configuration API routes are removed. The existing encrypted `ModelConfig` records are deliberately retained but have no runtime or browser path, avoiding destructive database changes during this deployment.

## Deployment and safety

`deploy/configure-host-responses.sh` interactively writes the root-owned environment file without echoing the key and restarts `agent-studio`. For this migration, the script running on the server will decrypt the existing `abc@163.com` record internally and write the unified values directly to `/etc/agent-studio.env`; the key is never emitted to the terminal. The deployed service is then tested with a minimal Responses request and a real Builder API flow.

## Verification

Unit and integration tests prove the environment provider, direct authenticated entry, and routes' use of host configuration. The deployment gate runs the suite, type check, production build, service status check, and a real API response request made within the host process.
