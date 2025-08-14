from agno.knowledge.pdf import PDFReader
import json

def read_pdf_tool(pdf_path: str) -> str:
    """PDFを読み取って、文字列を返します。

    Args:
        pdf_path: PDFのパス

    Returns:
        PDFの内容の文字列
    """
    try:
        reader = PDFReader(chunk=False)
        documents = reader.read(pdf=pdf_path)
        # Documentオブジェクトはそのままではjson.dumpsでシリアライズできないため、dictに変換する
        document_list = []
        for doc in documents:
            # Documentクラスが__dict__を持っていればそれを使う
            # もしくは、必要な属性だけ抽出する
            if hasattr(doc, "__dict__"):
                doc_dict = dict(doc.__dict__)
            else:
                # name, id, meta_data, content属性を持つと仮定
                doc_dict = {
                    "name": getattr(doc, "name", ""),
                    "id": getattr(doc, "id", ""),
                    "meta_data": getattr(doc, "meta_data", {}),
                    "content": getattr(doc, "content", ""),
                }
            document_list.append(doc_dict)
    except Exception as e:
        document_list = [{"content": "読み込めませんでした。", "error": str(e)}]
    
    document_str = json.dumps(document_list, ensure_ascii=False, indent=2)
    return document_str