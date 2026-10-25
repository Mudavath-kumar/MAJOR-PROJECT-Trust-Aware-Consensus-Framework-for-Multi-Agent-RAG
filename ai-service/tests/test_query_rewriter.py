from app.rag.query_rewriter import parse_search_query_rewrite


def test_query_rewriter_accepts_a_bounded_json_reformulation_for_a_typed_prompt():
    response = '{"search_query":"Summarize the selected PDF document."}'

    assert parse_search_query_rewrite(response, "summaries that odf") == (
        "Summarize the selected PDF document."
    )


def test_query_rewriter_does_not_turn_unclear_or_malformed_output_into_a_search():
    assert parse_search_query_rewrite('{"search_query":null}', "summaries that odf") is None
    assert parse_search_query_rewrite("Here is a summary of your document.", "summaries that odf") is None


def test_query_rewriter_does_not_retry_the_unchanged_question():
    assert parse_search_query_rewrite(
        '{"search_query":"What is a primary key?"}',
        "What is a primary key?",
    ) is None
