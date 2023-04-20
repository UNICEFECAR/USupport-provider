import {
  createTag,
  createAnswerQuery,
  archiveQuestionQuery,
  checkIsQuestionAnsweredQuery,
  getAllQuestionsQuery,
  getAllTagsQuery,
} from "#queries/myQA";

import { questionCantBeArchived } from "#utils/errors";

import { getMultipleProvidersDataByIDs } from "#queries/providers";

export const createAnswer = async ({
  country,
  question_id,
  title,
  text,
  provider_detail_id,
  tags,
}) => {
  const newTags = [];
  const oldTagIds = [];

  tags.forEach((tag) => {
    if (tag.isNew) {
      newTags.push(tag.tag);
    } else {
      oldTagIds.push(tag.tagId);
    }
  });

  const newTagIds = await createTag({
    poolCountry: country,
    tags: newTags,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows.map((x) => x.tag_id);
      }
    })
    .catch((err) => {
      throw err;
    });

  const tagIds = [...oldTagIds, ...newTagIds];

  return await createAnswerQuery({
    poolCountry: country,
    question_id,
    title,
    text,
    provider_detail_id,
    tags: tagIds,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return { success: true };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const archiveQuestion = async ({
  country,
  language,
  questionId,
  provider_detail_id,
  reason,
  additionalText,
}) => {
  const isQuestionAnswered = await checkIsQuestionAnsweredQuery({
    poolCountry: country,
    questionId,
  }).then((res) => {
    if (res.rowCount === 0) {
      return false;
    } else {
      return true;
    }
  });
  if (isQuestionAnswered) {
    throw questionCantBeArchived(language);
  }

  return await archiveQuestionQuery({
    poolCountry: country,
    questionId,
    provider_detail_id,
    reason,
    additionalText,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        throw questionCantBeArchived(language);
      } else {
        return { success: true };
      }
    })
    .catch((err) => {
      throw err;
    });
};

export const getAllQuestions = async ({
  country,
  type,
  provider_detail_id,
}) => {
  const questions = await getAllQuestionsQuery({
    poolCountry: country,
    type,
    provider_detail_id,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows;
      }
    })
    .catch((err) => {
      throw err;
    });

  if (type !== "unanswered") {
    // Get the details for all the providers
    const providerIds = Array.from(
      new Set(questions.map((x) => x.provider_detail_id))
    );
    const providersDetails = await getMultipleProvidersDataByIDs({
      poolCountry: country,
      providerDetailIds: providerIds,
    }).then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows;
      }
    });

    for (let i = 0; i < questions.length; i++) {
      questions[i].providerData = providersDetails.find(
        (x) => x.provider_detail_id === questions[i].provider_detail_id
      );

      questions[i].tags = questions[i].tags.filter((x) => x);
      questions[i].likes = questions[i].likes?.length || 0;
      questions[i].dislikes = questions[i].dislikes?.length || 0;
    }
  }

  return questions;
};

export const getAllTags = async ({ country }) => {
  return await getAllTagsQuery({
    poolCountry: country,
  })
    .then((res) => {
      if (res.rowCount === 0) {
        return [];
      } else {
        return res.rows;
      }
    })
    .catch((err) => {
      throw err;
    });
};
