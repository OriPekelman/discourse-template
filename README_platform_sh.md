Set the following environment variables, preferably before first push:

+-----------------------------------+-------------+---------------------------------------------------+---------+
| Name                              | Level       | Value                                             | Enabled |
+-----------------------------------+-------------+---------------------------------------------------+---------+
| env:DISCOURSE_DEVELOPER_EMAILS    | environment | example@platform.sh                               | true    |
| env:DISCOURSE_HOSTNAME            | environment | master-7rqtwti-project_id.eu-3.platformsh.site    | true    |
| env:DISCOURSE_MAXMIND_LICENSE_KEY | environment | alicensekey.                                      | true    |
+-----------------------------------+-------------+---------------------------------------------------+---------+

This requires a Medium to deploy (for the first time the assets compilation runs) - afterwards can be downgraded.

Having a white page until the asset complication is done is to be expected. Because the assets are not yet there. If you prefer you can move everything in the post_deploy to the deploy hook. Just expect the first time around to be very slow. Subsequent pushes should be fine.