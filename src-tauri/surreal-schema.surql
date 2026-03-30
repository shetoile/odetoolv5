DEFINE TABLE node SCHEMALESS;
DEFINE FIELD nodeId ON TABLE node TYPE string ASSERT $value != NONE;
DEFINE FIELD parentId ON TABLE node TYPE string;
DEFINE INDEX node_node_id_unique ON TABLE node COLUMNS nodeId UNIQUE;
DEFINE INDEX node_parent_order_idx ON TABLE node COLUMNS parentId, `order`;
DEFINE FIELD content ON TABLE node TYPE option<string>;

DEFINE TABLE project SCHEMALESS;
DEFINE FIELD projectId ON TABLE project TYPE string ASSERT $value != NONE;
DEFINE FIELD name ON TABLE project TYPE string;
DEFINE FIELD rootPath ON TABLE project TYPE string;
DEFINE FIELD rootNodeId ON TABLE project TYPE string;
DEFINE INDEX project_project_id_unique ON TABLE project COLUMNS projectId UNIQUE;
DEFINE INDEX project_root_path_unique ON TABLE project COLUMNS rootPath UNIQUE;

DEFINE TABLE task SCHEMALESS;
DEFINE FIELD taskId ON TABLE task TYPE string ASSERT $value != NONE;
DEFINE INDEX task_task_id_unique ON TABLE task COLUMNS taskId UNIQUE;

DEFINE TABLE taskLink SCHEMALESS;
DEFINE FIELD linkId ON TABLE taskLink TYPE string ASSERT $value != NONE;
DEFINE FIELD taskId ON TABLE taskLink TYPE string;
DEFINE FIELD nodeId ON TABLE taskLink TYPE string;
DEFINE INDEX task_link_unique ON TABLE taskLink COLUMNS taskId, nodeId UNIQUE;
