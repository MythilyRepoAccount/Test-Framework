# 03: Hooks and tags

**Prompt:**
> Implement hooks and tags. 2. Implement Hooks
>
> Implement Playwright hooks wherever appropriate.
>
> Use: test.beforeAll() test.afterAll() test.beforeEach() test.afterEach()
>
> Requirements:
> beforeEach: Navigate to the application and perform login when required.
> afterEach: Capture screenshots when a test fails.
> beforeAll: Perform suite-level setup only when necessary.
> afterAll: Perform suite-level cleanup when necessary.
> Avoid unnecessary hooks and explain why each hook is used.
>
> 3. Implement Tags
> Add test tags to the existing Login and Claim Creation test cases.
> Use the following tags: @smoke @sanity @regression @login

**Outcome:** the login suite was split into 5 tests so that tags and hooks apply per case. `beforeAll`/`afterAll` manage a shared BFF API session; there's no data cleanup because the API has no DELETE endpoint. While stabilising the suite, D2 was found: the login form does a GET with credentials in the URL if submitted before hydration.
