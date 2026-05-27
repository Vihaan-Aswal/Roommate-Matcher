import os
import ast

TEST_DIR = r"c:\Users\vihaa\OneDrive\Desktop\Roommate Matcher\backend\tests"

class FixtureUpdater(ast.NodeTransformer):
    def __init__(self, content):
        self.content = content
        self.modified = False
        self.db_var = "db_session"

    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name):
            if node.func.id == "Student":
                # Find if segment_key is there
                has_phone = any(kw.arg == "phone_number" for kw in node.keywords)
                has_seg_key = any(kw.arg == "segment_key" for kw in node.keywords)
                
                if has_seg_key:
                    for kw in node.keywords:
                        if kw.arg == "segment_key":
                            kw.arg = "segment_id"
                            # value is the node, replace with db_session.scalars(...).first().id
                            # But wait, building an AST for `db_session.scalars(select(Segment).where(Segment.segment_key == "...")).first().id` is painful.
                            
                            kw.value = ast.Attribute(
                                value=ast.Call(
                                    func=ast.Attribute(
                                        value=ast.Call(
                                            func=ast.Attribute(
                                                value=ast.Name(id=self.db_var, ctx=ast.Load()),
                                                attr="scalars",
                                                ctx=ast.Load()
                                            ),
                                            args=[
                                                ast.Call(
                                                    func=ast.Attribute(
                                                        value=ast.Call(
                                                            func=ast.Name(id="select", ctx=ast.Load()),
                                                            args=[ast.Name(id="Segment", ctx=ast.Load())],
                                                            keywords=[]
                                                        ),
                                                        attr="where",
                                                        ctx=ast.Load()
                                                    ),
                                                    args=[
                                                        ast.Compare(
                                                            left=ast.Attribute(
                                                                value=ast.Name(id="Segment", ctx=ast.Load()),
                                                                attr="segment_key",
                                                                ctx=ast.Load()
                                                            ),
                                                            ops=[ast.Eq()],
                                                            comparators=[kw.value]
                                                        )
                                                    ],
                                                    keywords=[]
                                                )
                                            ],
                                            keywords=[]
                                        ),
                                        attr="first",
                                        ctx=ast.Load()
                                    ),
                                    args=[],
                                    keywords=[]
                                ),
                                attr="id",
                                ctx=ast.Load()
                            )
                            self.modified = True

                if not has_phone:
                    node.keywords.append(ast.keyword(arg="phone_number", value=ast.Constant(value="9876543210")))
                    node.keywords.append(ast.keyword(arg="phone_last4", value=ast.Constant(value="3210")))
                    node.keywords.append(ast.keyword(arg="is_active", value=ast.Constant(value=True)))
                    self.modified = True
            
            elif node.func.id == "Room":
                has_is_active = any(kw.arg == "is_active" for kw in node.keywords)
                has_seg_key = any(kw.arg == "segment_key" for kw in node.keywords)
                
                if has_seg_key:
                    for kw in node.keywords:
                        if kw.arg == "segment_key":
                            kw.arg = "segment_id"
                            kw.value = ast.Attribute(
                                value=ast.Call(
                                    func=ast.Attribute(
                                        value=ast.Call(
                                            func=ast.Attribute(
                                                value=ast.Name(id=self.db_var, ctx=ast.Load()),
                                                attr="scalars",
                                                ctx=ast.Load()
                                            ),
                                            args=[
                                                ast.Call(
                                                    func=ast.Attribute(
                                                        value=ast.Call(
                                                            func=ast.Name(id="select", ctx=ast.Load()),
                                                            args=[ast.Name(id="Segment", ctx=ast.Load())],
                                                            keywords=[]
                                                        ),
                                                        attr="where",
                                                        ctx=ast.Load()
                                                    ),
                                                    args=[
                                                        ast.Compare(
                                                            left=ast.Attribute(
                                                                value=ast.Name(id="Segment", ctx=ast.Load()),
                                                                attr="segment_key",
                                                                ctx=ast.Load()
                                                            ),
                                                            ops=[ast.Eq()],
                                                            comparators=[kw.value]
                                                        )
                                                    ],
                                                    keywords=[]
                                                )
                                            ],
                                            keywords=[]
                                        ),
                                        attr="first",
                                        ctx=ast.Load()
                                    ),
                                    args=[],
                                    keywords=[]
                                ),
                                attr="id",
                                ctx=ast.Load()
                            )
                            self.modified = True

                if not has_is_active:
                    node.keywords.append(ast.keyword(arg="is_active", value=ast.Constant(value=True)))
                    self.modified = True

            elif node.func.id == "PreferenceProfile":
                has_admission = any(kw.arg == "admission_number" for kw in node.keywords)
                has_is_active = any(kw.arg == "is_active" for kw in node.keywords)

                if has_admission:
                    for kw in node.keywords:
                        if kw.arg == "admission_number":
                            kw.arg = "student_id"
                            kw.value = ast.Attribute(
                                value=ast.Call(
                                    func=ast.Attribute(
                                        value=ast.Call(
                                            func=ast.Attribute(
                                                value=ast.Name(id=self.db_var, ctx=ast.Load()),
                                                attr="scalars",
                                                ctx=ast.Load()
                                            ),
                                            args=[
                                                ast.Call(
                                                    func=ast.Attribute(
                                                        value=ast.Call(
                                                            func=ast.Name(id="select", ctx=ast.Load()),
                                                            args=[ast.Name(id="Student", ctx=ast.Load())],
                                                            keywords=[]
                                                        ),
                                                        attr="where",
                                                        ctx=ast.Load()
                                                    ),
                                                    args=[
                                                        ast.Compare(
                                                            left=ast.Attribute(
                                                                value=ast.Name(id="Student", ctx=ast.Load()),
                                                                attr="admission_number",
                                                                ctx=ast.Load()
                                                            ),
                                                            ops=[ast.Eq()],
                                                            comparators=[kw.value]
                                                        )
                                                    ],
                                                    keywords=[]
                                                )
                                            ],
                                            keywords=[]
                                        ),
                                        attr="first",
                                        ctx=ast.Load()
                                    ),
                                    args=[],
                                    keywords=[]
                                ),
                                attr="id",
                                ctx=ast.Load()
                            )
                            self.modified = True

                if not has_is_active:
                    node.keywords.append(ast.keyword(arg="is_active", value=ast.Constant(value=True)))
                    self.modified = True

        return node

def main():
    pass

if __name__ == "__main__":
    main()
