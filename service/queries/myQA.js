import { getDBPool } from "#utils/dbConfig";

export const createTag = async ({ poolCountry, tags }) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
        INSERT INTO tags (tag)
        SELECT unnest($1::varchar[])
        RETURNING tag_id;
    `,
    [tags]
  );
};

export const checkIsQuestionAnsweredQuery = async ({
  poolCountry,
  questionId,
}) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT answer_id
      FROM answer
      WHERE question_id = $1
      LIMIT 1;
    `,
    [questionId]
  );
};

export const createAnswerQuery = async ({
  poolCountry,
  question_id,
  title,
  text,
  provider_detail_id,
  tags,
}) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
    WITH
        answer AS (
            INSERT INTO answer (question_id, title, text, provider_detail_id)
            VALUES ($1, $2, $3, $4)
            RETURNING answer_id
        )
        INSERT INTO answer_tags_links (answer_id, tag_id)
        SELECT answer_id, unnest($5::uuid[])
        FROM answer;
    `,
    [question_id, title, text, provider_detail_id, tags]
  );
};

export const archiveQuestionQuery = async ({
  poolCountry,
  questionId,
  provider_detail_id,
  reason,
  additionalText,
}) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
    WITH inserted AS (
      UPDATE question
      SET status = 'archived'
      FROM (SELECT 1 FROM question WHERE question_id = $1 AND status = 'active') q
      WHERE question.question_id = $1
      RETURNING question.question_id
    )
    INSERT INTO question_report_log (question_id, provider_detail_id, reason, additional_text, action)
    SELECT $1, $2, $3, $4, 'archive'
    WHERE EXISTS (SELECT 1 FROM inserted);
    `,
    [questionId, provider_detail_id, reason, additionalText]
  );
};

export const getAllQuestionsQuery = async ({
  poolCountry,
  type,
  provider_detail_id,
}) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT 
        question.question, 
        question.created_at as question_created_at, 
        question.question_id as question_id,
        answer.answer_id as answer_id,
        answer.created_at as answer_created_at, 
        answer.title AS answer_title, 
        answer.text AS answer_text, 
        answer.provider_detail_id,
        answer.likes,
        answer.dislikes,
        array_agg(tags.tag) as tags
      FROM question
          LEFT JOIN answer on question.question_id = answer.question_id
          LEFT JOIN answer_tags_links on answer_tags_links.answer_id = answer.answer_id
          LEFT JOIN tags on answer_tags_links.tag_id = tags.tag_id
      WHERE  question.status = 'active' AND
           CASE WHEN $1 = 'answered' THEN answer.answer_id IS NOT NULL
                WHEN $1 = 'unanswered' THEN answer.answer_id IS NULL
                ELSE answer.provider_detail_id = $2 END 
      GROUP BY question.question, answer.answer_id, question.created_at, question.question_id
      ORDER BY question.created_at DESC;
      `,
    [type, provider_detail_id]
  );
};

export const getAllTagsQuery = async ({ poolCountry }) => {
  return await getDBPool("clinicalDb", poolCountry).query(
    `
      SELECT tag_id, tag
      FROM tags
      ORDER BY tag ASC;
    `
  );
};
