<?php

/**
 * Pure-PHP PKCS#1 (v2.1) compliant implementation of RSA.
 *
 * PHP version 5
 *
 * Here's an example of how to encrypt and decrypt text with this library:
 * <code>
 * <?php
 *    include 'vendor/autoload.php';
 *
 *    $rsa = new \phpseclib\Crypt\RSA();
 *    extract($rsa->createKey());
 *
 *    $plaintext = 'terrafrost';
 *
 *    $rsa->loadKey($privatekey);
 *    $ciphertext = $rsa->encrypt($plaintext);
 *
 *    $rsa->loadKey($publickey);
 *    echo $rsa->decrypt($ciphertext);
 * ?>
 * </code>
 *
 * Here's an example of how to create signatures and verify signatures with this library:
 * <code>
 * <?php
 *    include 'vendor/autoload.php';
 *
 *    $rsa = new \phpseclib\Crypt\RSA();
 *    extract($rsa->createKey());
 *
 *    $plaintext = 'terrafrost';
 *
 *    $rsa->loadKey($privatekey);
 *    $signature = $rsa->sign($plaintext);
 *
 *    $rsa->loadKey($publickey);
 *    echo $rsa->verify($plaintext, $signature) ? 'verified' : 'unverified';
 * ?>
 * </code>
 *
 * @category  Crypt
 * @package   RSA
 * @author    Jim Wigginton <terrafrost@php.net>
 * @copyright 2009 Jim Wigginton
 * @license   http://www.opensource.org/licenses/mit-license.html  MIT License
 * @link      http://phpseclib.sourceforge.net
 */

namespace phpseclib\Crypt;

use phpseclib\Math\BigInteger;

/**
 * Pure-PHP PKCS#1 compliant implementation of RSA.
 *
 * @package RSA
 * @author  Jim Wigginton <terrafrost@php.net>
 * @access  public
 */
class RSA
{
    /**#@+
     * @access public
     * @see self::encrypt()
     * @see self::decrypt()
     */
    /**
     * Use {@link http://en.wikipedia.org/wiki/Optimal_Asymmetric_Encryption_Padding Optimal Asymmetric Encryption Padding}
     * (OAEP) for encryption / decryption.
     *
     * Uses sha1 by default.
     *
     * @see self::setHash()
     * @see self::setMGFHash()
     */
    const ENCRYPTION_OAEP = 1;
    /**
     * Use PKCS#1 padding.
     *
     * Although self::ENCRYPTION_OAEP offers more security, including PKCS#1 padding is necessary for purposes of backwards
     * compatibility with protocols (like SSH-1) written before OAEP's introduction.
     */
    const ENCRYPTION_PKCS1 = 2;
    /**
     * Do not use any padding
     *
     * Although this method is not recommended it can none-the-less sometimes be useful if you're trying to decrypt some legacy
     * stuff, if you're trying to diagnose why an encrypted message isn't decrypting, etc.
     */
    const ENCRYPTION_NONE = 3;
    /**#@-*/

    /**#@+
     * @access public
     * @see self::sign()
     * @see self::verify()
     * @see self::setHash()
    */
    /**
     * Use the Probabilistic Signature Scheme for signing
     *
     * Uses sha1 by default.
     *
     * @see self::setSaltLength()
     * @see self::setMGFHash()
     */
    const SIGNATURE_PSS = 1;
    /**
     * Use the PKCS#1 scheme by default.
     *
     * Although self::SIGNATURE_PSS offers more security, including PKCS#1 signing is necessary for purposes of backwards
     * compatibility with protocols (like SSH-2) written before PSS's introduction.
     */
    const SIGNATURE_PKCS1 = 2;
    /**#@-*/

    /**#@+
     * @access private
     * @see \phpseclib\Crypt\RSA::createKey()
    */
    /**
     * ASN1 Integer
     */
    const ASN1_INTEGER = 2;
    /**
     * ASN1 Bit String
     */
    const ASN1_BITSTRING = 3;
    /**
     * ASN1 Octet String
     */
    const ASN1_OCTETSTRING = 4;
    /**
     * ASN1 Object Identifier
     */
    const ASN1_OBJECT = 6;
    /**
     * ASN1 Sequence (with the constucted bit set)
     */
    const ASN1_SEQUENCE = 48;
    /**#@-*/

    /**#@+
     * @access private
     * @see \phpseclib\Crypt\RSA::__construct()
    */
    /**
     * To use the pure-PHP implementation
     */
    const MODE_INTERNAL = 1;
    /**
     * To use the OpenSSL library
     *
     * (if enabled; otherwise, the internal implementation will be used)
     */
    const MODE_OPENSSL = 2;
    /**#@-*/

    /**#@+
     * @access public
     * @see \phpseclib\Crypt\RSA::createKey()
     * @see \phpseclib\Crypt\RSA::setPrivateKeyFormat()
    */
    /**
     * PKCS#1 formatted private key
     *
     * Used by OpenSSH
     */
    const PRIVATE_FORMAT_PKCS1 = 0;
    /**
     * PuTTY formatted private key
     */
    const PRIVATE_FORMAT_PUTTY = 1;
    /**
     * XML formatted private key
     */
    const PRIVATE_FORMAT_XML = 2;
    /**
     * PKCS#8 formatted private key
     */
    const PRIVATE_FORMAT_PKCS8 = 8;
    /**#@-*/

    /**#@+
     * @access public
     * @see \phpseclib\Crypt\RSA::createKey()
     * @see \phpseclib\Crypt\RSA::setPublicKeyFormat()
    */
    /**
     * Raw public key
     *
     * An array containing two \phpseclib\Math\BigInteger objects.
     *
     * The exponent can be indexed with any of the following:
     *
     * 0, e, exponent, publicExponent
     *
     * The modulus can be indexed with any of the following:
     *
     * 1, n, modulo, modulus
     */
    const PUBLIC_FORMAT_RAW = 3;
    /**
     * PKCS#1 formatted public key (raw)
     *
     * Used by File/X509.php
     *
     * Has the following header:
     *
     * -----BEGIN RSA PUBLIC KEY-----
     *
     * Analogous to ssh-keygen's pem format (as specified by -m)
     */
    const PUBLIC_FORMAT_PKCS1 = 4;
    const PUBLIC_FORMAT_PKCS1_RAW = 4;
    /**
     * XML formatted public key
     */
    const PUBLIC_FORMAT_XML = 5;
    /**
     * OpenSSH formatted public key
     *
     * Place in $HOME/.ssh/authorized_keys
     */
    const PUBLIC_FORMAT_OPENSSH = 6;
    /**
     * PKCS#1 formatted public key (encapsulated)
     *
     * Used by PHP's openssl_public_encrypt() and openssl's rsautl (when -pubin is set)
     *
     * Has the following header:
     *
     * -----BEGIN PUBLIC KEY-----
     *
     * Analogous to ssh-keygen's pkcs8 format (as specified by -m). Although PKCS8
     * is specific to private keys it's basically creating a DER-encoded wrapper
     * for keys. This just extends that same concept to public keys (much like ssh-keygen)
     */
    const PUBLIC_FORMAT_PKCS8 = 7;
    /**#@-*/

    /**
     * Precomputed Zero
     *
     * @var \phpseclib\Math\BigInteger
     * @access private
     */
    var $zero;

    /**
     * Precomputed One
     *
     * @var \phpseclib\Math\BigInteger
     * @access private
     */
    var $one;

    /**
     * Private Key Format
     *
     * @var int
     * @access private
     */
    var $privateKeyFormat = self::PRIVATE_FORMAT_PKCS1;

    /**
     * Public Key Format
     *
     * @var int
     * @access public
     */
    var $publicKeyFormat = self::PUBLIC_FORMAT_PKCS8;

    /**
     * Modulus (ie. n)
     *
     * @var \phpseclib\Math\BigInteger
     * @access private
     */
    var $modulus;

    /**
     * Modulus length
     *
     * @var \phpseclib\Math\BigInteger
     * @access private
     */
    var $k;

    /**
     * Exponent (ie. e or d)
     *
     * @var \phpseclib\Math\BigInteger
     * @access private
     */
    var $exponent;

    /**
     * Primes for Chinese Remainder Theorem (ie. p and q)
     *
     * @var array
     * @access private
     */
    var $primes;

    /**
     * Exponents for Chinese Remainder Theorem (ie. dP and dQ)
     *
     * @var array
     * @access private
     */
    var $exponents;

    /**
     * Coefficients for Chinese Remainder Theorem (ie. qInv)
     *
     * @var array
     * @access private
     */
    var $coefficients;

    /**
     * Hash name
     *
     * @var string
     * @access private
     */
    var $hashName;

    /**
     * Hash function
     *
     * @var \phpseclib\Crypt\Hash
     * @access private
     */
    var $hash;

    /**
     * Length of hash function output
     *
     * @var int
     * @access private
     */
    var $hLen;

    /**
     * Length of salt
     *
     * @var int
     * @access private
     */
    var $sLen;

    /**
     * Hash function for the Mask Generation Function
     *
     * @var \phpseclib\Crypt\Hash
     * @access private
     */
    var $mgfHash;

    /**
     * Length of MGF hash function output
     *
     * @var int
     * @access private
     */
    var $mgfHLen;

    /**
     * Encryption mode
     *
     * @var int
     * @access private
     */
    var $encryptionMode = self::ENCRYPTION_OAEP;

    /**
     * Signature mode
     *
     * @var int
     * @access private
     */
    var $signatureMode = self::SIGNATURE_PSS;

    /**
     * Public Exponent
     *
     * @var mixed
     * @access private
     */
    var $publicExponent = false;

    /**
     * Password
     *
     * @var string
     * @access private
     */
    var $password = false;

    /**
     * Components
     *
     * For use with parsing XML formatted keys.  PHP's XML Parser functions use utilized - instead of PHP's DOM functions -
     * because PHP's XML Parser functions work on PHP4 whereas PHP's DOM functions - although surperior - don't.
     *
     * @see self::_start_element_handler()
     * @var array
     * @access private
     */
    var $components = array();

    /**
     * Current String
     *
     * For use with parsing XML formatted keys.
     *
     * @see self::_character_handler()
     * @see self::_stop_element_handler()
     * @var mixed
     * @access private
     */
    var $current;

    /**
     * OpenSSL configuration file name.
     *
     * Set to null to use system configuration file.
     * @see self::createKey()
     * @var mixed
     * @Access public
     */
    var $configFile;

    /**
     * Public key comment field.
     *
     * @var string
     * @access private
     */
    var $comment = 'phpseclib-generated-key';

    /**
     * The constructor
     *
     * If you want to make use of the openssl extension, you'll need to set the mode manually, yourself.  The reason
     * \phpseclib\Crypt\RSA doesn't do it is because OpenSSL doesn't fail gracefully.  openssl_pkey_new(), in particular, requires
     * openssl.cnf be present somewhere and, unfortunately, the only real way to find out is too late.
     *
     * @return \phpseclib\Crypt\RSA
     * @access public
     */
    function __construct()
    {
        $this->configFile = dirname(__FILE__) . '/../openssl.cnf';

        if (!defined('CRYPT_RSA_MODE')) {
            switch (true) {
                // Math/BigInteger's openssl requirements are a little less stringent than Crypt/RSA's. in particular,
                // Math/BigInteger doesn't require an openssl.cfg file whereas Crypt/RSA does. so if Math/BigInteger
                // can't use OpenSSL it can be pretty trivially assumed, then, that Crypt/RSA can't either.
                case defined('MATH_BIGINTEGER_OPENSSL_DISABLE'):
                    define('CRYPT_RSA_MODE', self::MODE_INTERNAL);
                    break;
                case extension_loaded('openssl') && file_exists($this->configFile):
                    // some versions of XAMPP have mismatched versions of OpenSSL which causes it not to work
                    ob_start();
                    @phpinfo();
                    $content = ob_get_contents();
                    ob_end_clean();

                    preg_match_all('#OpenSSL (Header|Library) Version(.*)#im', $content, $matches);

                    $versions = array();
                    if (!empty($matches[1])) {
                        for ($i = 0; $i < count($matches[1]); $i++) {
                            $fullVersion = trim(str_replace('=>', '', strip_tags($matches[2][$i])));

                            // Remove letter part in OpenSSL version
                            if (!preg_match('/(\d+\.\d+\.\d+)/i', $fullVersion, $m)) {
                                $versions[$matches[1][$i]] = $fullVersion;
                            } else {
                                $versions[$matches[1][$i]] = $m[0];
                            }
                        }
                    }

                    // it doesn't appear that OpenSSL versions were reported upon until PHP 5.3+
                    switch (true) {
                        case !isset($versions['Header']):
                        case !isset($versions['Library']):
                        case $versions['Header'] == $versions['Library']:
                        case version_compare($versions['Header'], '1.0.0') >= 0 && version_compare($versions['Library'], '1.0.0') >= 0:
                            define('CRYPT_RSA_MODE', self::MODE_OPENSSL);
                            break;
                        default:
                            define('CRYPT_RSA_MODE', self::MODE_INTERNAL);
                            define('MATH_BIGINTEGER_OPENSSL_DISABLE', true);
                    }
                    break;
                default:
                    define('CRYPT_RSA_MODE', self::MODE_INTERNAL);
            }
        }

        $this->zero = new BigInteger();
        $this->one = new BigInteger(1);

        $this->hash = new Hash('sha1');
        $this->hLen = $this->hash->getLength();
        $this->hashName = 'sha1';
        $this->mgfHash = new Hash('sha1');
        $this->mgfHLen = $this->mgfHash->getLength();
    }

    /**
     * Create public / private key pair
     *
     * Returns an array with the following three elements:
     *  - 'privatekey': The private key.
     *  - 'publickey':  The public key.
     *  - 'partialkey': A partially computed key (if the execution time exceeded $timeout).
     *                  Will need to be passed back to \phpseclib\Crypt\RSA::createKey() as the third parameter for further processing.
     *
     * @access public
     * @param int $bits
     * @param int $timeout
     * @param array $p
     */
    function createKey($bits = 1024, $timeout = false, $partial = array())
    {
        if (!defined('CRYPT_RSA_EXPONENT')) {
            // http://en.wikipedia.org/wiki/65537_%28number%29
            define