import { getDBPool } from "#utils/dbConfig";

export const assignOrganizationsToProviderQuery = async ({
  organizationIds,
  providerDetailId,
  poolCountry,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
          WITH organization_ids AS (
            SELECT UNNEST($1::UUID[]) AS organization_id
          ),
          existing_links AS (
            SELECT organization_id, provider_detail_id
            FROM organization_provider_links
            WHERE provider_detail_id = $2
          )
          INSERT INTO organization_provider_links (organization_id, provider_detail_id)
          SELECT organization_ids.organization_id, $2
          FROM organization_ids
          LEFT JOIN existing_links
          ON organization_ids.organization_id = existing_links.organization_id
          WHERE existing_links.organization_id IS NULL
          RETURNING *;
        `,
    [organizationIds, providerDetailId]
  );
};

export const removeOrganizationsFromProviderQuery = async ({
  organizationIds,
  providerDetailId,
  poolCountry,
}) => {
  return await getDBPool("piiDb", poolCountry).query(
    `
            DELETE FROM organization_provider_links
            WHERE organization_id = ANY($1::UUID[]) AND provider_detail_id = $2
            RETURNING *;
            `,
    [organizationIds, providerDetailId]
  );
};
