from markitdown import MarkItDown
import json
import os


def read_document_tool(file_path: str) -> str:
    """Excel、Word、PowerPointファイルを読み取って、文字列を返します。
    
    Args:
        file_path: ドキュメントファイルのパス（.xlsx, .docx, .pptx対応）
        
    Returns:
        ドキュメントの内容の文字列（JSON形式）
    """
    try:
        # ファイルの存在確認
        if not os.path.exists(file_path):
            return json.dumps({"content": "ファイルが見つかりません。", "error": "FileNotFound"})
        
        # ファイル拡張子の確認
        file_ext = os.path.splitext(file_path)[1].lower()
        supported_formats = ['.xlsx', '.docx', '.pptx']
        
        if file_ext not in supported_formats:
            return json.dumps({
                "content": f"サポートされていないファイル形式です。対応形式: {', '.join(supported_formats)}", 
                "error": "UnsupportedFormat"
            })
        
        # MarkItDownインスタンスの作成
        md = MarkItDown(enable_plugins=False)
        
        # ファイルの変換
        result = md.convert(file_path)
        
        # 結果をJSON形式で返す
        document = {
            "content": result.text_content,
            "file_path": file_path,
            "file_type": file_ext,
            "success": True
        }
        
    except Exception as e:
        # エラーが発生した場合
        document = {
            "content": "読み込めませんでした。", 
            "error": str(e),
            "file_path": file_path,
            "success": False
        }
    
    document_str = json.dumps(document, ensure_ascii=False, indent=2)
    return document_str


# 個別のファイル形式用の関数も提供
def read_excel_tool(xlsx_path: str) -> str:
    """Excelファイルを読み取って、文字列を返します。
    
    Args:
        xlsx_path: Excelファイルのパス
        
    Returns:
        Excelファイルの内容の文字列
    """
    return read_document_tool(xlsx_path)


def read_word_tool(docx_path: str) -> str:
    """Wordファイルを読み取って、文字列を返します。
    
    Args:
        docx_path: Wordファイルのパス
        
    Returns:
        Wordファイルの内容の文字列
    """
    return read_document_tool(docx_path)


def read_powerpoint_tool(pptx_path: str) -> str:
    """PowerPointファイルを読み取って、文字列を返します。
    
    Args:
        pptx_path: PowerPointファイルのパス
        
    Returns:
        PowerPointファイルの内容の文字列
    """
    return read_document_tool(pptx_path)