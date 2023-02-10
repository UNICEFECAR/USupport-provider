import { getDBPool } from "#utils/dbConfig";

export const getCampaignDataForMultipleIds = ({ poolCountry, campaignIds }) => {
  return getDBPool("piiDb", poolCountry).query(
    `
        SELECT campaign_id, campaign.name AS campaign_name, campaign.start_date AS campaign_start_date, campaign.end_date AS campaign_end_date, coupon_code, sponsor.name AS sponsor_name, sponsor.image AS sponsor_image
        FROM campaign
            JOIN sponsor ON sponsor.sponsor_id = campaign.sponsor_id
        WHERE campaign.campaign_id = ANY($1);
    `,
    [campaignIds]
  );
};
