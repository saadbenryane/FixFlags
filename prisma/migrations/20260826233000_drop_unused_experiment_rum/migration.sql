-- Drop unused growth/RUM tables with no application readers.

DROP TABLE IF EXISTS "graph_experiment";
DROP TABLE IF EXISTS "rum_measurements";
