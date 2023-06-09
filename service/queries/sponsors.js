import { getDBPool } from "#utils/dbConfig";

export const getCampaignDataByIdQuery = ({ poolCountry, campaignId }) => {
  return getDBPool("piiDb", poolCountry).query(
    `
    SELECT campaign_id, campaign.name AS campaign_name, coupon_code, no_coupons, active, max_coupons_per_client, budget, terms_and_conditions, price_per_coupon, campaign.start_date AS campaign_start_date, campaign.end_date AS campaign_end_date, sponsor.name AS sponsor_name, sponsor.image AS sponsor_image
    FROM campaign
        JOIN sponsor ON sponsor.sponsor_id = campaign.sponsor_id
    WHERE campaign.campaign_id = $1
    `,
    [campaignId]
  );
};

export const getCampaignDataForMultipleIdsQuery = ({
  poolCountry,
  campaignIds,
}) => {
  return getDBPool("piiDb", poolCountry).query(
    `
        SELECT campaign_id, campaign.name AS campaign_name, active, campaign.start_date AS campaign_start_date, campaign.end_date AS campaign_end_date, coupon_code, sponsor.name AS sponsor_name, sponsor.image AS sponsor_image
        FROM campaign
            JOIN sponsor ON sponsor.sponsor_id = campaign.sponsor_id
        WHERE campaign.campaign_id = ANY($1);
    `,
    [campaignIds]
  );
};

export const getCampaignCouponPriceForMultipleIds = ({
  poolCountry,
  campaignIds,
}) => {
  return getDBPool("piiDb", poolCountry).query(
    `
        SELECT campaign_id, price_per_coupon, sponsor.image, sponsor.name
        FROM campaign
          JOIN sponsor ON sponsor.sponsor_id = campaign.sponsor_id
        WHERE campaign.campaign_id = ANY($1);
    `,
    [campaignIds]
  );
};

export const getCampignByCouponCodeQuery = ({ poolCountry, couponCode }) => {
  const pool = getDBPool("piiDb", poolCountry);
  return pool.query(
    `
        SELECT * FROM campaign WHERE coupon_code = $1
    `,
    [couponCode]
  );
};
