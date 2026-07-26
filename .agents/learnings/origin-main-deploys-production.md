# Origin main is the production code deployment path

## Finding

Pushing a commit to `origin/main` automatically starts a Railway production
deployment for the `QewOS` web service. Production tests performed before that
deployment reaches `SUCCESS` may exercise the previous commit.

## Prevention

For production code tests, commit only the intended verified scope, push
`main`, wait for the corresponding Railway deployment to succeed, then verify
the live health and product path. Do not run a second manual web deployment.
Railway variable changes may trigger their own redeployment and still require
the same success check.

## Evidence

The push of commit `1b74931` started Railway deployment
`fed24f49-8391-4575-9bf8-668ed9b612b4`; the CLI authorization URL fix became
live only after that deployment reached `SUCCESS`.
