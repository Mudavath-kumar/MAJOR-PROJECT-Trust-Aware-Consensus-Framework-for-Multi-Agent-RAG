# Graph Report - trustarc-core  (2026-09-11)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1763 nodes · 3165 edges · 122 communities (89 shown, 29 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7ccc6196`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- prompt-input.tsx
- rag.py
- superpowers/skills/brainstorming/scripts/server.cjs
- dependencies
- cn
- .agents/skills/brainstorming/scripts/server.cjs
- routeTree.gen.ts
- utils.ts
- react
- package.json
- sidebar.tsx
- test-sync-to-codex-plugin.sh
- lifecycle.test.js
- message.tsx
- auth.ts
- ApiClient
- button.tsx
- branding.test.js
- doc-store.ts
- server.test.js
- auth.test.js
- setup.sh
- environment.ts
- backend/package.json
- src/server.ts
- document.controller.ts
- compilerOptions
- sync-to-codex-plugin.sh
- _load_plugin
- components.json
- class-variance-authority
- auth.controller.ts
- menubar.tsx
- test-helpers.sh
- devDependencies
- sheet.tsx
- form.tsx
- index.tsx
- _bootstrap
- index.ts
- conversation.tsx
- breadcrumb.tsx
- bump-version.sh
- compilerOptions
- carousel.tsx
- dependencies
- backend/src/server.ts
- lint-shell.sh
- test-package-codex-plugin.sh
- input-group.tsx
- trustrag-data.ts
- test-bootstrap-caching.mjs
- isDbConnected
- chart.tsx
- superpowers.ts
- test-lint-shell.sh
- command.tsx
- superpowers/package.json
- windows-lifecycle.test.sh
- test-pi-extension.mjs
- devDependencies
- superpowers/skills/brainstorming/scripts/helper.js
- helper.test.js
- stop-server.test.sh
- ws-protocol.test.js
- analyze-token-usage.py
- .agents/skills/brainstorming/scripts/helper.js
- scripts
- navigation-menu.tsx
- PromptInput
- package-codex-plugin.sh
- test-find-polluter.sh
- .hermes-plugin/__init__.py
- superpowers/skills/brainstorming/scripts/stop-server.sh
- test-session-start.sh
- test-render-graphs.sh
- .agents/skills/brainstorming/scripts/stop-server.sh
- mongoose
- @tanstack/react-router
- shimmer.tsx
- superpowers/skills/writing-skills/render-graphs.js
- start-server.test.sh
- test-sdd-workspace.sh
- .agents/skills/writing-skills/render-graphs.js
- app.analytics.tsx
- superpowers.js
- mock_ctx
- test-bump-version.sh
- accordion.tsx
- test-worktree-path-policy.sh
- run-all.sh script
- scroll-area.tsx
- sonner.tsx
- session-start
- superpowers/skills/brainstorming/scripts/start-server.sh
- test-antigravity-tools.sh
- test-devin-plugin.sh
- .agents/skills/brainstorming/scripts/start-server.sh
- hover-card.tsx
- superpowers/skills/subagent-driven-development/scripts/review-package
- superpowers/skills/subagent-driven-development/scripts/sdd-workspace
- superpowers/skills/subagent-driven-development/scripts/task-brief
- superpowers/skills/systematic-debugging/find-polluter.sh
- antigravity/run-tests.sh
- run-skill-tests.sh
- test-marketplace-manifest.sh
- run-extended-multiturn-test.sh
- run-haiku-test.sh
- run-multiturn-test.sh
- kimi/run-tests.sh
- test-plugin-manifest.sh
- opencode/run-tests.sh
- .agents/skills/subagent-driven-development/scripts/review-package
- .agents/skills/subagent-driven-development/scripts/sdd-workspace
- .agents/skills/subagent-driven-development/scripts/task-brief
- .agents/skills/systematic-debugging/find-polluter.sh
- @radix-ui/react-aspect-ratio
- @radix-ui/react-collapsible

## God Nodes (most connected - your core abstractions)
1. `cn()` - 287 edges
2. `react` - 62 edges
3. `lucide-react` - 32 edges
4. `ApiClient` - 29 edges
5. `main()` - 27 edges
6. `isDbConnected()` - 26 edges
7. `compilerOptions` - 17 edges
8. `runTests()` - 16 edges
9. `main()` - 16 edges
10. `express` - 16 edges

## Surprising Connections (you probably didn't know these)
- `PromptInputActionMenuContent()` --calls--> `cn()`  [EXTRACTED]
  src/components/ai-elements/prompt-input.tsx → src/lib/utils.ts
- `PromptInputActionMenuItem()` --calls--> `cn()`  [EXTRACTED]
  src/components/ai-elements/prompt-input.tsx → src/lib/utils.ts
- `PromptInputBody()` --calls--> `cn()`  [EXTRACTED]
  src/components/ai-elements/prompt-input.tsx → src/lib/utils.ts
- `PromptInputButton()` --calls--> `cn()`  [EXTRACTED]
  src/components/ai-elements/prompt-input.tsx → src/lib/utils.ts
- `PromptInputCommand()` --calls--> `cn()`  [EXTRACTED]
  src/components/ai-elements/prompt-input.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (122 total, 29 thin omitted)

### Community 0 - "prompt-input.tsx"
Cohesion: 0.03
Nodes (67): AttachmentsContext, LocalAttachmentsContext, LocalReferencedSourcesContext, PromptInputActionAddAttachmentsProps, PromptInputActionAddScreenshotProps, PromptInputActionMenuContent(), PromptInputActionMenuContentProps, PromptInputActionMenuItem() (+59 more)

### Community 1 - "rag.py"
Cohesion: 0.06
Nodes (53): Any, run_critic(), Any, run_fact_checker(), _verify_externally(), Any, run_reasoner(), Any (+45 more)

### Community 2 - "superpowers/skills/brainstorming/scripts/server.cjs"
Cohesion: 0.05
Nodes (59): bootstrapPage(), brandMarkup(), broadcast(), browserLauncherForPlatform(), chmodOwnerOnly(), RFC-6455, clients, companionUrl() (+51 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (62): dependencies, ai, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @hookform/resolvers (+54 more)

### Community 4 - "cn"
Cohesion: 0.06
Nodes (54): @radix-ui/react-context-menu, @radix-ui/react-dropdown-menu, @radix-ui/react-select, @radix-ui/react-tabs, vaul, Card, CardContent, CardDescription (+46 more)

### Community 5 - ".agents/skills/brainstorming/scripts/server.cjs"
Cohesion: 0.06
Nodes (57): bootstrapPage(), brandMarkup(), broadcast(), browserLauncherForPlatform(), chmodOwnerOnly(), RFC-6455, clients, companionUrl() (+49 more)

### Community 6 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (37): @tanstack/react-query, getRouter(), AppShell(), Route, Route, Route, NAV, NavItem (+29 more)

### Community 7 - "utils.ts"
Cohesion: 0.06
Nodes (25): input-otp, @radix-ui/react-avatar, @radix-ui/react-popover, @radix-ui/react-progress, @radix-ui/react-radio-group, @radix-ui/react-slider, @radix-ui/react-switch, react-resizable-panels (+17 more)

### Community 8 - "react"
Cohesion: 0.11
Nodes (24): lucide-react, @radix-ui/react-checkbox, react, Message(), MessageContent(), MessageResponse, PromptInputFooter(), PromptInputSubmit() (+16 more)

### Community 9 - "package.json"
Cohesion: 0.06
Nodes (33): zod, name, private, sideEffects, type, clsx, date-fns, eslint (+25 more)

### Community 10 - "sidebar.tsx"
Cohesion: 0.07
Nodes (30): Sidebar, SidebarContent, SidebarContext, SidebarContextProps, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent (+22 more)

### Community 11 - "test-sync-to-codex-plugin.sh"
Cohesion: 0.15
Nodes (31): add_openai_agent_metadata_fixture(), assert_branch_absent(), assert_contains(), assert_current_branch(), assert_equals(), assert_file_equals(), assert_matches(), assert_not_contains() (+23 more)

### Community 12 - "lifecycle.test.js"
Cohesion: 0.11
Nodes (29): assert, firstServerStarted(), fs, httpStatus(), isWindowsLikeShell(), killAndWait(), makeShellTempDir(), newestSessionDir() (+21 more)

### Community 13 - "message.tsx"
Cohesion: 0.08
Nodes (29): streamdown, @streamdown/cjk, @streamdown/code, @streamdown/math, @streamdown/mermaid, MessageActionProps, MessageActions(), MessageActionsProps (+21 more)

### Community 14 - "auth.ts"
Cohesion: 0.13
Nodes (20): getAnalyticsSummary(), exportAuditTrail(), getEvidenceByMessageId(), getSettings(), ISettingsPayload, updateSettings(), authenticate(), AuthRequest (+12 more)

### Community 15 - "ApiClient"
Cohesion: 0.14
Nodes (8): ApiClient, scoreAnswer(), ChatPage(), ask(), loadChatHistory(), getFileTypeColor(), Dashboard(), SettingsPage()

### Community 16 - "button.tsx"
Cohesion: 0.11
Nodes (23): @radix-ui/react-alert-dialog, react-day-picker, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader() (+15 more)

### Community 17 - "branding.test.js"
Cohesion: 0.19
Nodes (24): assert, assertBrandedFallbackText(), assertBrandedWithLogo(), assertFramedLogoSupportsDarkTheme(), assertFramedScreenUsesBrandHeader(), assertHeaderAvoidsNarrowOverlap(), assertLogoKeepsTransparentBackground(), assertTelemetryImage() (+16 more)

### Community 18 - "doc-store.ts"
Cohesion: 0.16
Nodes (23): chunkText(), clearStore(), docType(), extractText(), getChunks(), getDocs(), ingestFile(), mapRemoteDocument() (+15 more)

### Community 19 - "server.test.js"
Cohesion: 0.15
Nodes (20): assert, assertStartedOnExpectedPort(), cleanup(), CONTENT_DIR, ensureSymlinkWorks(), fetch(), fs, http (+12 more)

### Community 20 - "auth.test.js"
Cohesion: 0.16
Nodes (20): assert, assertSecurityHeaders(), assertStartedOnExpectedPort(), cleanup(), CONTENT_DIR, EXPECTED_SECURITY_HEADERS, fs, get() (+12 more)

### Community 21 - "setup.sh"
Cohesion: 0.13
Nodes (16): HOME, OPENCODE_CONFIG_DIR, setup.sh script, XDG_CONFIG_HOME, run_missing_file_check(), run_present_file_check(), test-bootstrap-caching.sh script, test-plugin-loading.sh script (+8 more)

### Community 22 - "environment.ts"
Cohesion: 0.11
Nodes (15): __dirname, storageConfigured, env, envCandidates, envFile, authLimiter, globalLimiter, aiClient (+7 more)

### Community 23 - "backend/package.json"
Cohesion: 0.10
Nodes (20): description, zod, main, name, scripts, build, dev, start (+12 more)

### Community 24 - "src/server.ts"
Cohesion: 0.15
Nodes (14): @tanstack/react-start, consumeLastCapturedError(), describeError(), describeStatus(), originalConsoleError, safeStringify(), renderErrorPage(), fetch() (+6 more)

### Community 25 - "document.controller.ts"
Cohesion: 0.16
Nodes (8): deleteDocument(), getDocumentById(), getDocumentChunks(), getDocuments(), uploadDocument(), upload, AIService, StorageService

### Community 26 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+11 more)

### Community 27 - "sync-to-codex-plugin.sh"
Cohesion: 0.21
Nodes (17): append_git_ignored_directory_excludes(), append_git_ignored_file_excludes(), apply_to_preview_checkout(), confirm(), copy_local_destination_overlay(), copy_preserved_destination_metadata(), die(), ignored_directory_has_tracked_descendants() (+9 more)

### Community 28 - "_load_plugin"
Cohesion: 0.19
Nodes (7): _fire_pre_llm(), _load_plugin(), Copy the plugin module + a minimal skills tree in the given layout., Re-import plugin module fresh., TestBootstrapInjection, TestLayoutResolution, TestPluginRegistration

### Community 29 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 30 - "class-variance-authority"
Cohesion: 0.14
Nodes (15): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert, AlertDescription, AlertTitle, alertVariants, Badge() (+7 more)

### Community 31 - "auth.controller.ts"
Cohesion: 0.16
Nodes (13): getMe(), login(), register(), ISettingsRecord, Settings, SettingsSchema, IUserDocument, User (+5 more)

### Community 32 - "menubar.tsx"
Cohesion: 0.11
Nodes (12): @radix-ui/react-menubar, Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator (+4 more)

### Community 33 - "test-helpers.sh"
Cohesion: 0.18
Nodes (10): assert_contains(), assert_order(), cleanup_test_project(), create_test_project(), run_claude(), test-helpers.sh script, test-subagent-driven-development-integration.sh script, test-subagent-driven-development.sh script (+2 more)

### Community 34 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-prettier, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+9 more)

### Community 35 - "sheet.tsx"
Cohesion: 0.12
Nodes (15): @radix-ui/react-dialog, DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle, SheetContent (+7 more)

### Community 36 - "form.tsx"
Cohesion: 0.17
Nodes (14): @radix-ui/react-label, react-hook-form, FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext (+6 more)

### Community 37 - "index.tsx"
Cohesion: 0.13
Nodes (11): ScrollVideo(), links, SiteHeader(), AGENTS, CAPABILITIES, FAQ, METRICS, PIPELINE (+3 more)

### Community 38 - "_bootstrap"
Cohesion: 0.23
Nodes (5): _bootstrap(), _load(), TestBootstrapContent, TestSkillsDirResolution, TestStripFrontmatter

### Community 39 - "index.ts"
Cohesion: 0.14
Nodes (14): DocumentModel, DocumentSchema, IDocumentRecord, DocumentStatus, IAgentExecution, IConflictResolution, IConsensusResult, IConversation (+6 more)

### Community 40 - "conversation.tsx"
Cohesion: 0.14
Nodes (15): ai, use-stick-to-bottom, Conversation(), ConversationContent(), ConversationContentProps, ConversationDownload(), ConversationDownloadProps, ConversationEmptyState() (+7 more)

### Community 41 - "breadcrumb.tsx"
Cohesion: 0.14
Nodes (13): @radix-ui/react-slot, Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator() (+5 more)

### Community 42 - "bump-version.sh"
Cohesion: 0.30
Nodes (12): cmd_audit(), cmd_bump(), cmd_check(), preflight_manifests(), read_json_field(), read_manifest_field(), read_yaml_field(), require_tool() (+4 more)

### Community 43 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 44 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext (+6 more)

### Community 45 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, @aws-sdk/client-s3, axios, bcryptjs, cors, dotenv, express, express-rate-limit (+6 more)

### Community 46 - "backend/src/server.ts"
Cohesion: 0.19
Nodes (11): connectDB(), maintainDBConnection(), errorHandler(), router, router, router, router, app (+3 more)

### Community 47 - "lint-shell.sh"
Cohesion: 0.38
Nodes (12): add_shell_file(), collect_all_shell_files(), collect_changed_shell_files(), collect_requested_shell_files(), die(), ensure_git_work_tree(), is_shell_file(), require_tool() (+4 more)

### Community 48 - "test-package-codex-plugin.sh"
Cohesion: 0.36
Nodes (11): assert_contains(), assert_equals(), assert_not_matches(), extract_archive(), fail(), list_archive(), normalize_archive_paths(), pass() (+3 more)

### Community 49 - "input-group.tsx"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 50 - "trustrag-data.ts"
Cohesion: 0.15
Nodes (12): ACTIVITY, AGENT_STEPS, ANSWER, CHUNKS, CONFIDENCE_DIST, DocStatus, DOCUMENTS, HALLUCINATION (+4 more)

### Community 51 - "test-bootstrap-caching.mjs"
Cohesion: 0.17
Nodes (5): afterFirst, afterSecond, firstOutput, result, secondOutput

### Community 52 - "isDbConnected"
Cohesion: 0.33
Nodes (9): isDbConnected(), createConversation(), deleteConversation(), getConversations(), getMessages(), sendMessage(), Conversation, ConversationSchema (+1 more)

### Community 53 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload() (+2 more)

### Community 54 - "superpowers.ts"
Cohesion: 0.27
Nodes (10): bootstrapSkillPath, extensionDir, firstNonCompactionSummaryIndex(), getBootstrapContent(), messageContainsBootstrap(), packageRoot, piToolMapping(), skillsDir (+2 more)

### Community 55 - "test-lint-shell.sh"
Cohesion: 0.40
Nodes (9): assert_contains(), assert_not_contains(), configure_git_identity(), fail(), make_fixture_repo(), pass(), run_lint_shell(), test-lint-shell.sh script (+1 more)

### Community 56 - "command.tsx"
Cohesion: 0.18
Nodes (9): cmdk, Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator (+1 more)

### Community 57 - "superpowers/package.json"
Cohesion: 0.20
Nodes (9): description, keywords, main, name, pi, extensions, skills, type (+1 more)

### Community 58 - "windows-lifecycle.test.sh"
Cohesion: 0.36
Nodes (8): fail(), get_key_from_info(), get_port_from_info(), http_check(), pass(), windows-lifecycle.test.sh script, skip(), wait_for_server_info()

### Community 59 - "test-pi-extension.mjs"
Cohesion: 0.20
Nodes (5): __dirname, extensionPath, packageJsonPath, piToolsPath, repoRoot

### Community 60 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, tsx, @types/bcryptjs, @types/cors, @types/express, @types/jsonwebtoken, @types/multer, @types/node (+2 more)

### Community 61 - "superpowers/skills/brainstorming/scripts/helper.js"
Cohesion: 0.42
Nodes (7): connect(), nextReconnectDelay(), reloadAfterRecovery(), sessionKey(), setStatus(), showTombstone(), websocketUrl()

### Community 62 - "helper.test.js"
Cohesion: 0.22
Nodes (6): assert, fs, HELPER, moduleShim, path, src

### Community 63 - "stop-server.test.sh"
Cohesion: 0.39
Nodes (7): bad(), new_server_id(), ok(), stop-server.test.sh script, track_dir(), track_pid(), untrack_pid()

### Community 64 - "ws-protocol.test.js"
Cohesion: 0.25
Nodes (6): assert, crypto, RFC-6455, path, runTests(), SERVER_PATH

### Community 65 - "analyze-token-usage.py"
Cohesion: 0.31
Nodes (8): analyze_main_session(), calculate_cost(), format_tokens(), main(), Analyze a session file and return token usage broken down by agent., Analyze token usage from Claude Code session transcripts. Breaks down usage by…, Format token count with thousands separators., Calculate estimated cost in dollars.

### Community 66 - ".agents/skills/brainstorming/scripts/helper.js"
Cohesion: 0.42
Nodes (7): connect(), nextReconnectDelay(), reloadAfterRecovery(), sessionKey(), setStatus(), showTombstone(), websocketUrl()

### Community 67 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, ai:dev, backend:dev, build, build:dev, dev, format, lint (+1 more)

### Community 68 - "navigation-menu.tsx"
Cohesion: 0.25
Nodes (8): @radix-ui/react-navigation-menu, NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 69 - "PromptInput"
Cohesion: 0.22
Nodes (9): captureScreenshot(), convertBlobUrlToDataUrl(), PromptInput(), PromptInputActionAddAttachments(), PromptInputActionAddScreenshot(), PromptInputTextarea(), useOptionalPromptInputController(), useOptionalProviderAttachments() (+1 more)

### Community 70 - "package-codex-plugin.sh"
Cohesion: 0.46
Nodes (6): die(), infer_format_from_output(), metadata_root_from_dir(), prepare_metadata_root(), package-codex-plugin.sh script, usage()

### Community 71 - "test-find-polluter.sh"
Cohesion: 0.43
Nodes (6): assert_contains(), fail(), pass(), run_polluter(), setup_project(), test-find-polluter.sh script

### Community 72 - ".hermes-plugin/__init__.py"
Cohesion: 0.43
Nodes (5): _build_bootstrap(), Locate the stock skills/ tree for either supported install layout. - git-clone…, register(), _skills_dir(), _strip_frontmatter()

### Community 73 - "superpowers/skills/brainstorming/scripts/stop-server.sh"
Cohesion: 0.52
Nodes (6): command_has_server_id(), command_line_for_pid(), is_brainstorm_server(), mark_stopped(), read_expected_server_id(), stop-server.sh script

### Community 74 - "test-session-start.sh"
Cohesion: 0.57
Nodes (5): assert_command_output(), fail(), make_home(), pass(), test-session-start.sh script

### Community 75 - "test-render-graphs.sh"
Cohesion: 0.67
Nodes (5): assert_contains(), assert_not_contains(), fail(), pass(), test-render-graphs.sh script

### Community 76 - ".agents/skills/brainstorming/scripts/stop-server.sh"
Cohesion: 0.52
Nodes (6): command_has_server_id(), command_line_for_pid(), is_brainstorm_server(), mark_stopped(), read_expected_server_id(), stop-server.sh script

### Community 77 - "mongoose"
Cohesion: 0.29
Nodes (4): Feedback, FeedbackSchema, IFeedbackRecord, mongoose

### Community 79 - "shimmer.tsx"
Cohesion: 0.33
Nodes (6): getMotionComponent(), motionComponentCache, MotionHTMLProps, Shimmer, ShimmerComponent(), TextShimmerProps

### Community 80 - "superpowers/skills/writing-skills/render-graphs.js"
Cohesion: 0.60
Nodes (5): combineGraphs(), extractDotBlocks(), extractGraphBody(), main(), renderToSvg()

### Community 81 - "start-server.test.sh"
Cohesion: 0.53
Nodes (4): fail(), make_fake_uname(), pass(), start-server.test.sh script

### Community 82 - "test-sdd-workspace.sh"
Cohesion: 0.53
Nodes (4): fail(), main(), pass(), test-sdd-workspace.sh script

### Community 83 - ".agents/skills/writing-skills/render-graphs.js"
Cohesion: 0.60
Nodes (5): combineGraphs(), extractDotBlocks(), extractGraphBody(), main(), renderToSvg()

### Community 84 - "app.analytics.tsx"
Cohesion: 0.33
Nodes (4): Analytics(), AXIS, Route, TOOLTIP

### Community 85 - "superpowers.js"
Cohesion: 0.60
Nodes (4): __dirname, extractAndStripFrontmatter(), normalizePath(), SuperpowersPlugin()

### Community 87 - "test-bump-version.sh"
Cohesion: 0.60
Nodes (3): fail(), make_fixture(), test-bump-version.sh script

### Community 88 - "accordion.tsx"
Cohesion: 0.40
Nodes (4): @radix-ui/react-accordion, AccordionContent, AccordionItem, AccordionTrigger

### Community 90 - "test-worktree-path-policy.sh"
Cohesion: 0.83
Nodes (3): assert_contains(), assert_not_contains(), test-worktree-path-policy.sh script

### Community 93 - "scroll-area.tsx"
Cohesion: 0.50
Nodes (3): @radix-ui/react-scroll-area, ScrollArea, ScrollBar

## Knowledge Gaps
- **499 isolated node(s):** `AttachmentsContext`, `PromptInputActionAddAttachmentsProps`, `PromptInputActionAddScreenshotProps`, `PromptInputActionMenuContentProps`, `PromptInputActionMenuItemProps` (+494 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 651 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `prompt-input.tsx`, `routeTree.gen.ts`, `utils.ts`, `react`, `sidebar.tsx`, `message.tsx`, `button.tsx`, `class-variance-authority`, `menubar.tsx`, `sheet.tsx`, `form.tsx`, `conversation.tsx`, `breadcrumb.tsx`, `carousel.tsx`, `input-group.tsx`, `chart.tsx`, `command.tsx`, `navigation-menu.tsx`, `PromptInput`, `shimmer.tsx`, `accordion.tsx`, `scroll-area.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `prompt-input.tsx`, `cn`, `routeTree.gen.ts`, `utils.ts`, `package.json`, `sidebar.tsx`, `message.tsx`, `button.tsx`, `doc-store.ts`, `class-variance-authority`, `menubar.tsx`, `sheet.tsx`, `form.tsx`, `index.tsx`, `conversation.tsx`, `breadcrumb.tsx`, `carousel.tsx`, `input-group.tsx`, `chart.tsx`, `command.tsx`, `navigation-menu.tsx`, `@tanstack/react-router`, `shimmer.tsx`, `app.analytics.tsx`, `accordion.tsx`, `scroll-area.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `@types/node` connect `backend/package.json` to `package.json`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `AttachmentsContext`, `PromptInputActionAddAttachmentsProps`, `PromptInputActionAddScreenshotProps` to the rest of the system?**
  _499 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `prompt-input.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.02564102564102564 - nodes in this community are weakly interconnected._
- **Should `rag.py` be split into smaller, more focused modules?**
  _Cohesion score 0.061457418788410885 - nodes in this community are weakly interconnected._
- **Should `superpowers/skills/brainstorming/scripts/server.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.051923076923076926 - nodes in this community are weakly interconnected._