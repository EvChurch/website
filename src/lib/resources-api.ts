/**
 * GraphQL client for resources.ev.church sermon API.
 * Handles pagination and retry logic.
 */

const GRAPHQL_ENDPOINT = 'https://resources.ev.church/graphql'
const MAX_RETRIES = 3

interface GraphQLResponse<T> {
  data: T
  errors?: Array<{ message: string }>
}

interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface Connection<T> {
  nodes: T[]
  pageInfo: PageInfo
}

/**
 * Execute a GraphQL query against resources.ev.church.
 * Retries with exponential backoff on failure.
 */
export async function resourcesGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      })

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status}`)
      }

      const json = (await response.json()) as GraphQLResponse<T>

      if (json.errors?.length) {
        throw new Error(
          `GraphQL errors: ${json.errors.map((e) => e.message).join(', ')}`,
        )
      }

      return json.data
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt)),
        )
      }
    }
  }

  throw lastError!
}

/**
 * Fetch all pages of a paginated GraphQL query using Relay-style cursor pagination.
 *
 * The query must contain `$cursor` as a placeholder for the `after` argument,
 * and the connection must include `nodes` and `pageInfo { hasNextPage endCursor }`.
 *
 * @param query - GraphQL query with `$cursor` placeholder
 * @param connectionKey - The key in the response data that contains the connection
 */
export async function fetchAllPages<T>(
  query: string,
  connectionKey: string,
  maxItems?: number,
): Promise<T[]> {
  const allNodes: T[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    // Replace $cursor placeholder with actual cursor value
    const actualQuery: string = cursor
      ? query.replace('after: $cursor', `after: "${cursor}"`)
      : query.replace(', after: $cursor', '').replace('after: $cursor', '')

    const data: Record<string, Connection<T>> =
      await resourcesGraphQL<Record<string, Connection<T>>>(actualQuery)
    const connection: Connection<T> = data[connectionKey]

    allNodes.push(...connection.nodes)

    if (maxItems && allNodes.length >= maxItems) {
      return allNodes.slice(0, maxItems)
    }

    hasNextPage = connection.pageInfo.hasNextPage
    cursor = connection.pageInfo.endCursor
  }

  return allNodes
}
